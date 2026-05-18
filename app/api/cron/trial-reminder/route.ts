import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendKakaoAlimtalk } from '@/lib/kakao/alimtalk'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function getBearerToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return null
  if (!authHeader.startsWith('Bearer ')) return null
  return authHeader.replace('Bearer ', '').trim()
}

function isCronAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return true
  return getBearerToken(request) === cronSecret
}

export async function GET(request: NextRequest) {
  try {
    if (!isCronAuthorized(request)) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 })
    }

    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)

    const tomorrowStart = new Date(tomorrow)
    tomorrowStart.setHours(0, 0, 0, 0)

    const tomorrowEnd = new Date(tomorrow)
    tomorrowEnd.setHours(23, 59, 59, 999)

    const subscriptions = await prisma.subscription.findMany({
      where: {
        status: 'trial',
        nextBillingAt: {
          gte: tomorrowStart,
          lte: tomorrowEnd,
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

      const alimtalkResult = await sendKakaoAlimtalk({
        to: user.guardianPhone,
        parentName: '보호자',
        message: '보호자님, 곁에 무료 체험이 내일 종료됩니다.\n후기를 남겨주시면 7일 무료 연장을 도와드릴게요 🎁',
        templateCode: process.env.KAKAO_ALIMTALK_TEMPLATE_CODE_REVIEW,
      })

      results.push({
        userId: user.id,
        userName: user.name,
        phone: user.guardianPhone,
        status: alimtalkResult.statusText,
      })
    }

    return NextResponse.json({ ok: true, total: subscriptions.length, results })
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : '무료체험 알림 크론 오류' },
      { status: 500 }
    )
  }
}