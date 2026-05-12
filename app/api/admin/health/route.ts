import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type EnvCheck = {
  name: string;
  required: boolean;
  exists: boolean;
  status: "ok" | "missing";
};

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

function checkEnv(name: string, required = true): EnvCheck {
  const exists = Boolean(process.env[name]);

  return {
    name,
    required,
    exists,
    status: exists ? "ok" : "missing",
  };
}

function groupStatus(items: EnvCheck[]) {
  const requiredMissing = items.some((item) => item.required && !item.exists);

  return requiredMissing ? "needs_setup" : "ok";
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

    const authEnvs = [
      checkEnv("NEXTAUTH_URL"),
      checkEnv("NEXTAUTH_SECRET"),
      checkEnv("KAKAO_CLIENT_ID"),
      checkEnv("KAKAO_CLIENT_SECRET"),
    ];

    const databaseEnvs = [
      checkEnv("DATABASE_URL"),
      checkEnv("DIRECT_URL", false),
      checkEnv("NEXT_PUBLIC_SUPABASE_URL"),
      checkEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
      checkEnv("SUPABASE_SERVICE_ROLE_KEY"),
    ];

    const kakaoPayEnvs = [
      checkEnv("KAKAOPAY_CID"),
      checkEnv("KAKAOPAY_ADMIN_KEY"),
      checkEnv("KAKAOPAY_SUBSCRIPTION_URL", false),
    ];

    const tossEnvs = [
      checkEnv("TOSS_SECRET_KEY"),
      checkEnv("TOSS_CLIENT_KEY", false),
      checkEnv("NEXT_PUBLIC_TOSS_CLIENT_KEY", false),
    ];

    const cronEnvs = [
      checkEnv("CRON_SECRET"),
      checkEnv("ADMIN_SECRET"),
    ];

    const webPushEnvs = [
      checkEnv("VAPID_EMAIL", false),
      checkEnv("VAPID_PRIVATE_KEY", false),
      checkEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", false),
    ];

    const aiEnvs = [
      checkEnv("ANTHROPIC_API_KEY", false),
    ];

    const alimtalkEnvs = [
      checkEnv("KAKAO_ALIMTALK_API_URL"),
      checkEnv("KAKAO_ALIMTALK_API_KEY"),
      checkEnv("KAKAO_ALIMTALK_SENDER_KEY"),
      checkEnv("KAKAO_ALIMTALK_TEMPLATE_CODE"),
    ];

    let dbStatus: "ok" | "error" = "ok";
    let dbMessage = "Database connection is healthy";
    let dbCounts:
      | {
          users: number;
          parents: number;
          subscriptions: number;
          paymentLogs: number;
          notificationLogs: number;
        }
      | null = null;

    try {
      const [
        users,
        parents,
        subscriptions,
        paymentLogs,
        notificationLogs,
      ] = await Promise.all([
        prisma.user.count(),
        prisma.parent.count(),
        prisma.subscription.count(),
        prisma.paymentLog.count(),
        prisma.notificationLog.count(),
      ]);

      dbCounts = {
        users,
        parents,
        subscriptions,
        paymentLogs,
        notificationLogs,
      };
    } catch (error) {
      dbStatus = "error";
      dbMessage =
        error instanceof Error
          ? error.message
          : "Unknown database connection error";
    }

    const summary = {
      auth: groupStatus(authEnvs),
      database: dbStatus,
      kakaoPay: groupStatus(kakaoPayEnvs),
      toss: groupStatus(tossEnvs),
      cron: groupStatus(cronEnvs),
      webPush: groupStatus(webPushEnvs),
      ai: groupStatus(aiEnvs),
      alimtalk: groupStatus(alimtalkEnvs),
    };

    const overallOk =
      summary.auth === "ok" &&
      summary.database === "ok" &&
      summary.kakaoPay === "ok" &&
      summary.toss === "ok" &&
      summary.cron === "ok";

    const productionReady =
      overallOk && summary.alimtalk === "ok";

    return NextResponse.json({
      ok: overallOk,
      productionReady,
      checkedAt: new Date().toISOString(),
      summary,
      database: {
        status: dbStatus,
        message: dbMessage,
        counts: dbCounts,
      },
      services: {
        auth: {
          status: groupStatus(authEnvs),
          envs: authEnvs,
        },
        database: {
          status: dbStatus,
          envs: databaseEnvs,
        },
        kakaoPay: {
          status: groupStatus(kakaoPayEnvs),
          envs: kakaoPayEnvs,
        },
        toss: {
          status: groupStatus(tossEnvs),
          envs: tossEnvs,
        },
        cron: {
          status: groupStatus(cronEnvs),
          envs: cronEnvs,
        },
        webPush: {
          status: groupStatus(webPushEnvs),
          envs: webPushEnvs,
        },
        ai: {
          status: groupStatus(aiEnvs),
          envs: aiEnvs,
        },
        alimtalk: {
          status: groupStatus(alimtalkEnvs),
          envs: alimtalkEnvs,
          note:
            groupStatus(alimtalkEnvs) === "ok"
              ? "Alimtalk environment variables are configured."
              : "Alimtalk is not ready. Add sender API URL, API key, sender key, and template code from your Kakao BizMessage provider.",
        },
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown admin health error";

    return NextResponse.json(
      {
        ok: false,
        message,
      },
      { status: 500 }
    );
  }
}