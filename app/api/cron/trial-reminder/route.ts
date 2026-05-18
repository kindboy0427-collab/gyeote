import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendKakaoAlimtalk } from '@/lib/kakao/alimtalk'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const dayAfter = new Date(tomorrow)
  dayAfter.setDate(dayAfter.getDate() + 1)

  const subscriptions = await prisma.subscription.findMany({
    where: {
      status: 'trial',
      nextBillingAt: {
        gte: tomorrow,
        lt: dayAfter,
      },
    },
    include: {
      user: {
        include: { parents: true },
      },
    },
  })

  let sent = 0

  for (const sub of subscriptions) {
    const user = sub.user
    const parents = user.parents

    // 리뷰 토큰 생성
    const reviewToken = crypto.randomBytes(20).toString('hex')
    await prisma.user.update({
      where: { id: user.id },
      data: { reviewToken },
    })

    const reviewUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/review?token=${reviewToken}`

    for (const parent of parents) {
      await sendKakaoAlimtalk({
        to: parent.phone,
        parentName: parent.name,
        message: reviewUrl,
        templateCode: process.env.KAKAO_ALIMTALK_TEMPLATE_CODE_REVIEW,
      })
      sent++
    }
  }

  return NextResponse.json({ ok: true, sent })
}