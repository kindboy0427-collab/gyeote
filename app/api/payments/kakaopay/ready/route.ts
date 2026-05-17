import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../../src/lib/auth'
import { prisma } from '../../../../../src/lib/prisma'

type PlanId = 'monthly' | 'yearly'

const PLAN_CONFIG: Record<PlanId, { name: string; price: number }> = {
  monthly: {
    name: '곁에 ?�간 구독',
    price: 4900,
  },
  yearly: {
    name: '곁에 ?�간 구독',
    price: 50000,
  },
}

function getRequiredEnv(name: string) {
  const value = process.env[name]

  if (!value) {
    throw new Error(`${name} ?�경변?��? ?�정?��? ?�았?�니??`)
  }

  return value
}

function isPlanId(value: unknown): value is PlanId {
  return value === 'monthly' || value === 'yearly'
}

function createOrderId(plan: PlanId) {
  return `gyeote_kakaopay_${plan}_${Date.now()}`
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
    const rawPlan = body?.plan

    if (!isPlanId(rawPlan)) {
      return NextResponse.json(
        { error: '?�효?��? ?��? 구독 ?�품?�니??' },
        { status: 400 }
      )
    }

    const plan: PlanId = rawPlan

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

    const cid = getRequiredEnv('KAKAOPAY_CID')
    const secretKey = getRequiredEnv('KAKAOPAY_ADMIN_KEY')

    const selectedPlan = PLAN_CONFIG[plan]
    const orderId = createOrderId(plan)
    const origin = req.nextUrl.origin

    const response = await fetch(
      'https://open-api.kakaopay.com/online/v1/payment/ready',
      {
        method: 'POST',
        headers: {
          Authorization: `SECRET_KEY ${secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cid,
          partner_order_id: orderId,
          partner_user_id: user.id,
          item_name: selectedPlan.name,
          quantity: 1,
          total_amount: selectedPlan.price,
          tax_free_amount: 0,
          approval_url: `${origin}/payment/success?provider=KAKAO_PAY&plan=${plan}&orderId=${orderId}`,
          cancel_url: `${origin}/payment/fail?provider=KAKAO_PAY&plan=${plan}&reason=cancel`,
          fail_url: `${origin}/payment/fail?provider=KAKAO_PAY&plan=${plan}&reason=fail`,
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
            '카카?�페??결제 준비에 ?�패?�습?�다.',
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
        status: 'pending',
        price: selectedPlan.price,
        tid: data.tid,
        sid: null,
        billingKey: null,
        customerKey: null,
        nextBillingAt: getNextBillingAt(plan),
        canceledAt: null,
      },
      create: {
        userId: user.id,
        plan,
        provider: 'KAKAO_PAY',
        status: 'pending',
        price: selectedPlan.price,
        tid: data.tid,
        nextBillingAt: getNextBillingAt(plan),
      },
    })

    return NextResponse.json({
      success: true,
      orderId,
      tid: data.tid,
      next_redirect_pc_url: data.next_redirect_pc_url,
      next_redirect_mobile_url: data.next_redirect_mobile_url,
      next_redirect_app_url: data.next_redirect_app_url,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : '카카?�페??결제 준�?�??�류가 발생?�습?�다.',
      },
      { status: 500 }
    )
  }
}
