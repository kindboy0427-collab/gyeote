import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateTodayMessage, sendKakaoAlimtalk } from '@/lib/kakao/alimtalk'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const KST_TIME_ZONE = 'Asia/Seoul'
const SEND_START_HHMM = '12:00'
const SEND_END_HHMM = '13:00'

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

function getKstParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: KST_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })

  const parts = formatter.formatToParts(date)

  return Object.fromEntries(
    parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value])
  )
}

function getCurrentKstHHmm() {
  const parts = getKstParts()
  return `${parts.hour}:${parts.minute}`
}

function getTodayKstRange() {
  const parts = getKstParts()

  return {
    start: new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00.000+09:00`),
    end: new Date(`${parts.year}-${parts.month}-${parts.day}T23:59:59.999+09:00`),
  }
}

function hhmmToMinutes(hhmm: string) {
  const [hour, minute] = hhmm.split(':').map(Number)

  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return null
  }

  return hour * 60 + minute
}

function isWithinSendWindow(currentHHmm: string) {
  const current = hhmmToMinutes(currentHHmm)
  const start = hhmmToMinutes(SEND_START_HHMM)
  const end = hhmmToMinutes(SEND_END_HHMM)

  if (current === null || start === null || end === null) {
    return false
  }

  return current >= start && current <= end
}

function createLunchMessage(
  parentName: string,
  todayMessage: string,
  medication: string | null
) {
  if (medication) {
    return `${parentName}님, 점심은 챙겨 드셨나요?

${todayMessage}

그리고 오늘 ${medication}도 잊지 않고 챙겨 주세요.
작은 습관이 건강을 지켜드려요.

항상 곁에 있을게요.
- 곁에`
  }

  return `${parentName}님, 점심은 챙겨 드셨나요?

${todayMessage}

맛있게 식사하시고 오후도 편안하게 보내세요.

항상 곁에 있을게요.
- 곁에`
}

export async function GET(request: NextRequest) {
  try {
    if (!isCronAuthorized(request)) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 })
    }

    const currentKstHHmm = getCurrentKstHHmm()
    const { start, end } = getTodayKstRange()

    if (!isWithinSendWindow(currentKstHHmm)) {
      return NextResponse.json({
        ok: true,
        blocked: true,
        message: `점심 알림 허용 시간(${SEND_START_HHMM}~${SEND_END_HHMM}) 밖입니다.`,
        currentKstHHmm,
      })
    }

    const parents = await prisma.parent.findMany({
      where: {
        isActive: true,
        mealCheck: true,
        user: {
          subscriptions: {
            some: { status: { in: ['active', 'trial'] } },
          },
        },
      },
      include: {
        responses: {
          where: {
            date: { gte: start, lte: end },
            type: 'lunch',
          },
          take: 1,
        },
      },
    })

    const todayMessage = await generateTodayMessage('lunch')
    const results = []

    for (const parent of parents) {
      if (parent.responses.length > 0) {
        results.push({
          parentId: parent.id,
          parentName: parent.name,
          status: 'already_exists',
        })

        continue
      }

      const medication =
        typeof parent.medication === 'string' && parent.medication.trim().length > 0
          ? parent.medication.trim()
          : null

      const message = createLunchMessage(parent.name, todayMessage, medication)

      await prisma.response.create({
        data: {
          parentId: parent.id,
          responded: false,
          message,
          type: 'lunch',
        },
      })

      const alimtalkResult = await sendKakaoAlimtalk({
        to: parent.phone,
        parentName: parent.name,
        message,
        templateCode: medication
          ? process.env.KAKAO_ALIMTALK_TEMPLATE_CODE_LUNCH_MED
          : process.env.KAKAO_ALIMTALK_TEMPLATE_CODE_LUNCH,
      })

      await prisma.notificationLog.create({
        data: {
          userId: parent.userId,
          parentId: parent.id,
          channel: 'KAKAO_ALIMTALK',
          status: alimtalkResult.success ? 'sent' : 'failed',
          message,
          error: alimtalkResult.reason ?? alimtalkResult.error ?? null,
          rawData: JSON.parse(
            JSON.stringify({
              kind: medication ? 'LUNCH_MEDICATION' : 'LUNCH',
              medication,
              ...alimtalkResult,
            })
          ),
        },
      })

      results.push({
        parentId: parent.id,
        parentName: parent.name,
        status: alimtalkResult.success ? 'sent' : 'failed',
        medication: medication ?? null,
      })
    }

    return NextResponse.json({
      ok: true,
      currentKstHHmm,
      count: results.length,
      results,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : '점심 Cron 처리 중 오류가 발생했습니다.',
      },
      { status: 500 }
    )
  }
}