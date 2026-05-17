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

    // 내일 만료되는 trial 구독 찾기
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
        user: {
          include: {
            parents: true,
          },
        },
      },
    })

    const results = []

    for (const sub of subscriptions) {
      for (const parent of sub.user.parents) {
        const alimtalkResult = await sendKakaoAlimtalk({
          to: parent.phone,
          parentName: parent.name,
          message: '후기를 남겨주시면 1주일 무료 연장해드려요 😊',
          templateCode: process.env.KAKAO_ALIMTALK_TEMPLATE_CODE_REVIEW,
        })

        results.push({
          parentName: parent.name,
          phone: parent.phone,
          status: alimtalkResult.statusText,
        })
      }
    }

    return NextResponse.json({ ok: true, total: subscriptions.length, results })
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : '알 수 없는 오류' },
      { status: 500 }
    )
  }
}