import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const { token, rating, content } = await req.json()

    if (!token || !content || !rating) {
      return NextResponse.json({ error: '필수 항목이 없습니다.' }, { status: 400 })
    }

    const user = await prisma.user.findFirst({
      where: { reviewToken: token },
      include: { subscriptions: true },
    })

    if (!user) {
      return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 404 })
    }

    // 이미 후기 작성했는지 확인 (중복 방지)
    const existing = await prisma.review.findFirst({
      where: { userId: user.id },
    })
    if (existing) {
      return NextResponse.json({ error: '이미 후기를 작성하셨습니다.' }, { status: 409 })
    }

    // 후기 저장
    await prisma.review.create({
      data: {
        userId: user.id,
        content,
        rating,
      },
    })

    // 구독 7일 연장
    const subscription = user.subscriptions.find(
      (s) => s.status === 'trial' || s.status === 'active'
    )

    if (subscription) {
      const base = subscription.nextBillingAt ?? new Date()
      const newDate = new Date(base)
      newDate.setDate(newDate.getDate() + 7)

      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { nextBillingAt: newDate },
      })
    }

    // 토큰 사용 처리 (재사용 방지)
    await prisma.user.update({
      where: { id: user.id },
      data: { reviewToken: null },
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: 'Failed', detail: String(e) }, { status: 500 })
  }
}