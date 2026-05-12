import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../../src/lib/auth'
import { prisma } from '../../../../../src/lib/prisma'

type PlanId = 'monthly' | 'yearly'

const PLAN_CONFIG: Record<PlanId, { price: number }> = {
  monthly: { price: 4900 },
  yearly: { price: 50000 },
}

function getRequiredEnv(name: string) {
  const value = process.env[name]

  if (!value) {
    throw new Error(`${name} 환경변수가 설정되지 않았습니다.`)
  }

  return value
}

function isPlanId(value: unknown): value is PlanId {
  return value === 'monthly' || value === 'yearly'
}

function getNextBillingAt(plan: PlanId) {
  const nextBillingAt = new Date()

  if (plan === 'yearly') {
    nextBillingAt.setFullYear(nextBillingAt.getFullYear() + 1)
  } else {
    nextBillingAt.setMonth(nextBillingAt.getMonth() + 1)
  }

  return nextBillingAt
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const kakaoId = (session?.user as any)?.id
  const sessionEmail = session?.user?.email ?? ''

  if (!kakaoId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { pgToken, orderId } = body
    const rawPlan = body?.plan

    if (!isPlanId(rawPlan)) {
      return NextResponse.json(
        { error: '유효하지 않은 구독 상품입니다.' },
        { status: 400 }
      )
    }

    if (!pgToken || typeof pgToken !== 'string') {
      return NextResponse.json(
        { error: 'pgToken이 필요합니다.' },
        { status: 400 }
      )
    }

    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json(
        { error: 'orderId가 필요합니다.' },
        { status: 400 }
      )
    }

    const plan: PlanId = rawPlan
    const selectedPlan = PLAN_CONFIG[plan]

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: `kakao_${kakaoId}@gyeote.com` },
          { email: sessionEmail },
        ],
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    const subscription = await prisma.subscription.findUnique({
      where: { userId: user.id },
    })

    if (!subscription || !subscription.tid) {
      return NextResponse.json(
        { error: '카카오페이 결제 준비 정보가 없습니다.' },
        { status: 400 }
      )
    }

    const cid = getRequiredEnv('KAKAOPAY_CID')
    const secretKey = getRequiredEnv('KAKAOPAY_ADMIN_KEY')

    const response = await fetch(
      'https://open-api.kakaopay.com/online/v1/payment/approve',
      {
        method: 'POST',
        headers: {
          Authorization: `SECRET_KEY ${secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cid,
          tid: subscription.tid,
          partner_order_id: orderId,
          partner_user_id: user.id,
          pg_token: pgToken,
        }),
      }
    )

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            data?.error_message ||
            data?.msg ||
            data?.message ||
            '카카오페이 결제 승인에 실패했습니다.',
          data,
        },
        { status: 502 }
      )
    }

    await prisma.subscription.upsert({
      where: { userId: user.id },
      update: {
        plan,
        provider: 'KAKAO_PAY',
        status: 'active',
        price: selectedPlan.price,
        sid: data.sid ?? subscription.sid ?? null,
        tid: data.tid ?? subscription.tid,
        billingKey: null,
        customerKey: null,
        lastPaidAt: new Date(),
        nextBillingAt: getNextBillingAt(plan),
        canceledAt: null,
      },
      create: {
        userId: user.id,
        plan,
        provider: 'KAKAO_PAY',
        status: 'active',
        price: selectedPlan.price,
        sid: data.sid ?? null,
        tid: data.tid ?? subscription.tid,
        lastPaidAt: new Date(),
        nextBillingAt: getNextBillingAt(plan),
      },
    })

    return NextResponse.json({
      success: true,
      provider: 'KAKAO_PAY',
      plan,
      price: selectedPlan.price,
      sid: data.sid ?? null,
      tid: data.tid ?? subscription.tid,
      nextBillingAt: getNextBillingAt(plan),
      data,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : '카카오페이 결제 승인 중 오류가 발생했습니다.',
      },
      { status: 500 }
    )
  }
}