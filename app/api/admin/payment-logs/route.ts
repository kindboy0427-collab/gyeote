import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getBearerToken(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader) {
    return null;
  }

  if (!authHeader.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.replace("Bearer ", "").trim();
}

function parseLimit(value: string | null) {
  if (!value) {
    return 50;
  }

  const parsed = Number(value);

  if (Number.isNaN(parsed)) {
    return 50;
  }

  if (parsed < 1) {
    return 1;
  }

  if (parsed > 100) {
    return 100;
  }

  return parsed;
}

function hideSensitiveRaw(raw: unknown, includeRaw: boolean) {
  if (includeRaw) {
    return raw;
  }

  return undefined;
}

export async function GET(request: NextRequest) {
  try {
    const adminSecret = process.env.ADMIN_SECRET;

    if (!adminSecret) {
      return NextResponse.json(
        {
          ok: false,
          message: "ADMIN_SECRET is not configured",
        },
        { status: 500 }
      );
    }

    const token = getBearerToken(request);

    if (!token || token !== adminSecret) {
      return NextResponse.json(
        {
          ok: false,
          message: "Unauthorized",
        },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);

    const limit = parseLimit(searchParams.get("limit"));
    const status = searchParams.get("status");
    const provider = searchParams.get("provider");
    const userId = searchParams.get("userId");
    const subscriptionId = searchParams.get("subscriptionId");
    const includeRaw = searchParams.get("includeRaw") === "true";

    const where: {
      status?: string;
      provider?: string;
      userId?: string;
      subscriptionId?: string;
    } = {};

    if (status) {
      where.status = status;
    }

    if (provider) {
      where.provider = provider;
    }

    if (userId) {
      where.userId = userId;
    }

    if (subscriptionId) {
      where.subscriptionId = subscriptionId;
    }

    const logs = await prisma.paymentLog.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        subscription: {
          select: {
            id: true,
            plan: true,
            provider: true,
            status: true,
            price: true,
            nextBillingAt: true,
            lastPaidAt: true,
            canceledAt: true,
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      count: logs.length,
      filters: {
        limit,
        status: status ?? null,
        provider: provider ?? null,
        userId: userId ?? null,
        subscriptionId: subscriptionId ?? null,
        includeRaw,
      },
      logs: logs.map((log) => ({
        id: log.id,
        userId: log.userId,
        subscriptionId: log.subscriptionId,
        provider: log.provider,
        status: log.status,
        amount: log.amount,
        orderId: log.orderId,
        paymentKey: log.paymentKey,
        errorMessage: log.errorMessage,
        createdAt: log.createdAt,
        raw: hideSensitiveRaw(log.raw, includeRaw),
        user: log.user
          ? {
              id: log.user.id,
              email: log.user.email,
              name: log.user.name,
            }
          : null,
        subscription: log.subscription
          ? {
              id: log.subscription.id,
              plan: log.subscription.plan,
              provider: log.subscription.provider,
              status: log.subscription.status,
              price: log.subscription.price,
              nextBillingAt: log.subscription.nextBillingAt,
              lastPaidAt: log.subscription.lastPaidAt,
              canceledAt: log.subscription.canceledAt,
            }
          : null,
      })),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown admin payment logs error";

    return NextResponse.json(
      {
        ok: false,
        message,
      },
      { status: 500 }
    );
  }
}
