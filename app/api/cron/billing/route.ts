import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type BillingProvider = "KAKAO_PAY" | "TOSS";

type BillingResult = {
  success: boolean;
  provider: BillingProvider;
  paymentKey?: string;
  orderId?: string;
  raw?: unknown;
  errorMessage?: string;
};

function addOneMonth(date: Date) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + 1);
  return next;
}

function addOneYear(date: Date) {
  const next = new Date(date);
  next.setFullYear(next.getFullYear() + 1);
  return next;
}

function getNextBillingDate(current: Date, plan: string | null | undefined) {
  const normalizedPlan = plan?.toLowerCase();

  if (normalizedPlan === "yearly") {
    return addOneYear(current);
  }

  return addOneMonth(current);
}

function createOrderId(subscriptionId: string) {
  return `gyeote_${subscriptionId}_${Date.now()}`;
}

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

function getPlanName(plan: string | null | undefined) {
  return plan?.toLowerCase() === "yearly" ? "곁에 연간 구독" : "곁에 월간 구독";
}

async function requestKakaoPaySubscriptionPayment(params: {
  subscriptionId: string;
  userId: string;
  sid: string;
  price: number;
  plan: string | null;
}): Promise<BillingResult> {
  const cid = getRequiredEnv("KAKAOPAY_CID");
  const secretKey = getRequiredEnv("KAKAOPAY_ADMIN_KEY");

  const url =
    process.env.KAKAOPAY_SUBSCRIPTION_URL ??
    "https://open-api.kakaopay.com/online/v1/payment/subscription";

  const orderId = createOrderId(params.subscriptionId);

  const body = {
    cid,
    sid: params.sid,
    partner_order_id: orderId,
    partner_user_id: params.userId,
    item_name: getPlanName(params.plan),
    quantity: 1,
    total_amount: params.price,
    tax_free_amount: 0,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `SECRET_KEY ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    return {
      success: false,
      provider: "KAKAO_PAY",
      orderId,
      raw: data,
      errorMessage:
        data?.error_message ??
        data?.msg ??
        `KakaoPay subscription failed: ${response.status}`,
    };
  }

  return {
    success: true,
    provider: "KAKAO_PAY",
    orderId,
    paymentKey: data?.aid ?? data?.tid ?? orderId,
    raw: data,
  };
}

async function requestTossBillingPayment(params: {
  subscriptionId: string;
  customerKey: string;
  billingKey: string;
  price: number;
  plan: string | null;
  customerEmail?: string | null;
  customerName?: string | null;
}): Promise<BillingResult> {
  const secretKey = getRequiredEnv("TOSS_SECRET_KEY");
  const orderId = createOrderId(params.subscriptionId);

  const encodedSecret = Buffer.from(`${secretKey}:`).toString("base64");

  const response = await fetch(
    `https://api.tosspayments.com/v1/billing/${params.billingKey}`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${encodedSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customerKey: params.customerKey,
        amount: params.price,
        orderId,
        orderName: getPlanName(params.plan),
        customerEmail: params.customerEmail ?? undefined,
        customerName: params.customerName ?? undefined,
      }),
    }
  );

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    return {
      success: false,
      provider: "TOSS",
      orderId,
      raw: data,
      errorMessage:
        data?.message ??
        data?.code ??
        `Toss billing failed: ${response.status}`,
    };
  }

  return {
    success: true,
    provider: "TOSS",
    orderId,
    paymentKey: data?.paymentKey ?? orderId,
    raw: data,
  };
}

async function createBillingLog(params: {
  subscriptionId: string;
  userId: string;
  provider: BillingProvider;
  status: "SUCCESS" | "FAILED";
  price: number;
  orderId?: string;
  paymentKey?: string;
  errorMessage?: string;
  raw?: unknown;
}) {
  try {
    const db = prisma as any;

    if (!db.paymentLog) {
      return;
    }

    await db.paymentLog.create({
      data: {
        subscriptionId: params.subscriptionId,
        userId: params.userId,
        provider: params.provider,
        status: params.status,
        amount: params.price,
        orderId: params.orderId,
        paymentKey: params.paymentKey,
        errorMessage: params.errorMessage,
        raw: params.raw,
      },
    });
  } catch {
    // 결제 로그 저장 실패가 자동 청구 자체를 막지 않도록 무시합니다.
  }
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        {
          ok: false,
          message: "Unauthorized",
        },
        { status: 401 }
      );
    }

    const now = new Date();
    const db = prisma as any;

    const subscriptions = await db.subscription.findMany({
      where: {
        status: "active",
        nextBillingAt: {
          lte: now,
        },
      },
      include: {
        user: true,
      },
      take: 50,
      orderBy: {
        nextBillingAt: "asc",
      },
    });

    const results: Array<{
      subscriptionId: string;
      provider: string;
      success: boolean;
      message?: string;
    }> = [];

    for (const subscription of subscriptions) {
      const price =
        typeof subscription.price === "number"
          ? subscription.price
          : subscription.plan?.toLowerCase() === "yearly"
            ? 50000
            : 4900;

      const plan = subscription.plan ?? "monthly";
      const provider = subscription.provider as BillingProvider;

      let result: BillingResult;

      try {
        if (provider === "KAKAO_PAY") {
          if (!subscription.sid) {
            throw new Error("Missing KakaoPay sid");
          }

          result = await requestKakaoPaySubscriptionPayment({
            subscriptionId: subscription.id,
            userId: subscription.userId,
            sid: subscription.sid,
            price,
            plan,
          });
        } else if (provider === "TOSS") {
          if (!subscription.billingKey) {
            throw new Error("Missing Toss billingKey");
          }

          result = await requestTossBillingPayment({
            subscriptionId: subscription.id,
            customerKey: subscription.customerKey ?? subscription.userId,
            billingKey: subscription.billingKey,
            price,
            plan,
            customerEmail: subscription.user?.email,
            customerName: subscription.user?.name,
          });
        } else {
          throw new Error(`Unsupported provider: ${provider}`);
        }

        if (result.success) {
          const nextBillingAt = getNextBillingDate(now, plan);

          await db.subscription.update({
            where: {
              id: subscription.id,
            },
            data: {
              status: "active",
              lastPaidAt: now,
              nextBillingAt,
            },
          });

          await createBillingLog({
            subscriptionId: subscription.id,
            userId: subscription.userId,
            provider,
            status: "SUCCESS",
            price,
            orderId: result.orderId,
            paymentKey: result.paymentKey,
            raw: result.raw,
          });

          results.push({
            subscriptionId: subscription.id,
            provider,
            success: true,
          });
        } else {
          await db.subscription.update({
            where: {
              id: subscription.id,
            },
            data: {
              status: "failed",
            },
          });

          await createBillingLog({
            subscriptionId: subscription.id,
            userId: subscription.userId,
            provider,
            status: "FAILED",
            price,
            orderId: result.orderId,
            paymentKey: result.paymentKey,
            errorMessage: result.errorMessage,
            raw: result.raw,
          });

          results.push({
            subscriptionId: subscription.id,
            provider,
            success: false,
            message: result.errorMessage,
          });
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown billing error";

        await db.subscription.update({
          where: {
            id: subscription.id,
          },
          data: {
            status: "failed",
          },
        });

        await createBillingLog({
          subscriptionId: subscription.id,
          userId: subscription.userId,
          provider,
          status: "FAILED",
          price,
          errorMessage: message,
        });

        results.push({
          subscriptionId: subscription.id,
          provider,
          success: false,
          message,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      checkedAt: now.toISOString(),
      count: subscriptions.length,
      results,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown cron billing error";

    return NextResponse.json(
      {
        ok: false,
        message,
      },
      { status: 500 }
    );
  }
}