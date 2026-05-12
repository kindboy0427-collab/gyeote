import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../src/lib/auth'
import { prisma } from '../../../src/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const kakaoId = (session?.user as any)?.id
  if (!kakaoId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { paymentKey, orderId, amount } = await req.json()

  try {
    // 토스페이먼츠 결제 승인
    const response = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(process.env.TOSS_SECRET_KEY + ':').toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json({ error: data.message }, { status: 400 })
    }

    // 유저 찾기
    const user = await prisma.user.findFirst({
      where: { email: `kakao_${kakaoId}@gyeote.com` },
    })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // 구독 정보 저장
    const nextBilling = new Date()
    nextBilling.setMonth(nextBilling.getMonth() + 1)

    await prisma.subscription.upsert({
      where: { userId: user.id },
      update: {
        status: 'active',
        plan: 'care',
        price: 5900,
        billingKey: data.paymentKey,
        nextBillingAt: nextBilling,
      },
      create: {
        userId: user.id,
        status: 'active',
        plan: 'care',
        price: 5900,
        billingKey: data.paymentKey,
        nextBillingAt: nextBilling,
      },
    })

    return NextResponse.json({ success: true, data })
  } catch (e) {
    console.error('Payment error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}