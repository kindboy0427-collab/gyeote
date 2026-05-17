import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const { phone, content, rating } = await req.json()

    if (!phone || !content) {
      return NextResponse.json({ error: '전화번호와 후기 내용이 필요합니다.' }, { status: 400 })
    }

    // 전화번호로 부모님 찾기
    const parent = await prisma.parent.findFirst({
      where: { phone: phone.replace(/-/g, '') },
      include: { user: { include: { subscriptions: true } } },
    })

    if (!parent) {
      return NextResponse.json({ error: '등록된 부모님을 찾을 수 없습니다.' }, { status: 404 })
    }

    const user = parent.user

    // 후기 저장
    await prisma.review.create({
      data: {
        userId: user.id,
        content,
        rating: rating ?? 5,
      },
    })

    // 구독 1주일 연장
    const subscription = user.subscriptions.find(
      (s) => s.status === 'trial' || s.status === 'active'
    )

    if (subscription) {
      const current = subscription.nextBillingAt ?? new Date()
      const newDate = new Date(current)
      newDate.setDate(newDate.getDate() + 7)

      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { nextBillingAt: newDate },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: 'Failed', detail: String(e) }, { status: 500 })
  }
}