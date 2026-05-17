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
        user: {
          include: {
            parents: true,
          },
        },
      },
    })

    const results = []

    for (const sub of subscriptions) {
      const user = sub.user
      if (!user) continue

      const price = sub.price.toLocaleString('ko-KR')
      const plan = sub.plan?.toLowerCase() === 'yearly' ? '?�간' : '?�간'
      const message = `${user.name ?? '?�용??}?? ?�일 ${plan} 구독 ${price}?�이 ?�동 결제?�니???��\n\n계속 ?�용?�시�?별도 조치 ?�이 ?�동?�로 결제?�요.\n?��?�??�하?�면 ?�?�보?�에???�제?��? ?��??????�어??\n\n??�� 곁에 ?�을게요.\n- 곁에`

      const templateCode = process.env.KAKAO_ALIMTALK_TEMPLATE_CODE_BILLING_REMINDER

      const alimtalkResult = await sendKakaoAlimtalk({
        to: user.parents?.[0]?.phone ?? '',
        parentName: user.name ?? '?�용??,
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
      { ok: false, message: error instanceof Error ? error.message : '결제 ?�림 ?�론 ?�류' },
      { status: 500 }
    )
  }
}
