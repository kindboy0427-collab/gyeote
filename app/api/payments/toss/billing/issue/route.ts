import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../../../src/lib/auth'
import { prisma } from '../../../../../../src/lib/prisma'

type PlanId = 'monthly' | 'yearly'

const PLAN_CONFIG: Record<PlanId, { price: number }> = {
  monthly: { price: 4900 },
  yearly: { price: 50000 },
}

function isPlanId(value: unknown): value is PlanId {
  return value === 'monthly' || value === 'yearly'
}

function getRequiredEnv(name: string) {
  const value = process.env[name]

  if (!value) {
    throw new Error(`${name} ?�경변?��? ?�정?��? ?�았?�니??`)
  }

  return value
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
    const { authKey, customerKey } = body
    const rawPlan = body?.plan

    if (!isPlanId(rawPlan)) {
      return NextResponse.json(
        { error: '?�효?��? ?��? 구독 ?�품?�니??' },
        { status: 400 }
      )
    }

    if (!authKey || typeof authKey !== 'string') {
      return NextResponse.json(
        { error: 'authKey가 ?�요?�니??' },
        { status: 400 }
      )
    }

    if (!customerKey || typeof customerKey !== 'string') {
      return NextResponse.json(
        { error: 'customerKey가 ?�요?�니??' },
        { status: 400 }
      )
    }

    const plan: PlanId = rawPlan
    const selectedPlan = PLAN_CONFIG[plan]

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: session?.user?.email ?? `kakao_${kakaoId}@gyeote.com` },
          { email: sessionEmail },
        ],
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: '?�용?��? 찾을 ???�습?�다.' },
        { status: 404 }
      )
    }

    const tossSecretKey = getRequiredEnv('TOSS_SECRET_KEY')

    const response = await fetch('https://api.tosspayments.com/v1/billing/authorizations/issue', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${tossSecretKey}:`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        authKey,
        customerKey,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            data?.message ||
            data?.error ||
            '?�스 ?�동결제 빌링??발급???�패?�습?�다.',
          data,
        },
        { status: 502 }
      )
    }

    await prisma.subscription.upsert({
      where: { userId: user.id },
      update: {
        plan,
        provider: 'TOSS',
        status: 'active',
        price: selectedPlan.price,
        billingKey: data.billingKey,
        customerKey,
        sid: null,
        tid: null,
        lastPaidAt: new Date(),
        nextBillingAt: getNextBillingAt(plan),
        canceledAt: null,
      },
      create: {
        userId: user.id,
        plan,
        provider: 'TOSS',
        status: 'active',
        price: selectedPlan.price,
        billingKey: data.billingKey,
        customerKey,
        lastPaidAt: new Date(),
        nextBillingAt: getNextBillingAt(plan),
      },
    })

    return NextResponse.json({
      success: true,
      provider: 'TOSS',
      plan,
      price: selectedPlan.price,
      billingKey: data.billingKey,
      customerKey,
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
            : '?�스 ?�동결제 ?�록 �??�류가 발생?�습?�다.',
      },
      { status: 500 }
    )
  }
}
