import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendKakaoAlimtalk } from '@/lib/kakao/alimtalk'
import crypto from 'crypto'

export async function GET(req: NextRequest) {
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
      user: true,
    },
  })

  let sent = 0
  const results = []

  for (const sub of subscriptions) {
    const user = sub.user

    // 자녀 전화번호 없으면 스킵
    if (!user.guardianPhone) {
      results.push({ userId: user.id, status: 'skipped', reason: 'guardianPhone 없음' })
      continue
    }

    // 리뷰 토큰 생성
    const reviewToken = crypto.randomBytes(20).toString('hex')
    await prisma.user.update({
      where: { id: user.id },
      data: { reviewToken },
    })

    const reviewUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/review?token=${reviewToken}`

    const alimtalkResult = await sendKakaoAlimtalk({
      to: user.guardianPhone,           // ✅ 자녀 번호
      parentName: user.name ?? '고객',  // ✅ 자녀 이름
      message: reviewUrl,
      templateCode: process.env.KAKAO_ALIMTALK_TEMPLATE_CODE_REVIEW,
    })

    results.push({
      userId: user.id,
      userName: user.name,
      status: alimtalkResult.success ? 'sent' : 'failed',
      error: alimtalkResult.error ?? null,
    })

    if (alimtalkResult.success) sent++
  }

  return NextResponse.json({ ok: true, sent, results })
}