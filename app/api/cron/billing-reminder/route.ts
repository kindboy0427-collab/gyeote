import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendKakaoAlimtalk } from '@/lib/kakao/alimtalk'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function isCronAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return true
  const authHeader = request.headers.get('authorization')
  return authHeader === `Bearer ${cronSecret}`
}

export async function GET(request: NextRequest) {
  try {
    if (!isCronAuthorized(request)) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 })
    }

    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)

    const dayAfter = new Date(tomorrow)
    dayAfter.setHours(23, 59, 59, 999)

    const subscriptions = await prisma.subscription.findMany({
      where: {
        status: 'active',
        nextBillingAt: {
          gte: tomorrow,
          lte: dayAfter,
        },
      },
      include: {
        user: true,
      },
    })

    const results = []

    for (const sub of subscriptions) {
      const user = sub.user
      if (!user?.guardianPhone) {
        results.push({
          userId: user?.id,
          userName: user?.name,
          status: 'skipped',
          reason: 'guardianPhone 없음',
        })
        continue
      }

      const price = sub.price.toLocaleString('ko-KR')
      const plan = sub.plan?.toLowerCase() === 'yearly' ? '연간' : '월간'
      const message = `보호자님, 내일 ${plan} 구독 ${price}원이 자동 결제됩니다 💳\n\n계속 이용하시면 별도 조치 없이 자동으로 결제돼요.\n해지를 원하시면 대시보드에서 언제든지 해지할 수 있어요.\n\n항상 곁에 있을게요.\n- 곁에`

      const templateCode = process.env.KAKAO_ALIMTALK_TEMPLATE_CODE_BILLING_REMINDER

      const alimtalkResult = await sendKakaoAlimtalk({
        to: user.guardianPhone,
        parentName: '보호자',
        message,
        templateCode,
      })

      results.push({
        userId: user.id,
        userName: user.name,
        status: alimtalkResult.success ? 'sent' : 'failed',
      })
    }

    return NextResponse.json({ ok: true, count: subscriptions.length, results })
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : '결제 알림 크론 오류' },
      { status: 500 }
    )
  }
}