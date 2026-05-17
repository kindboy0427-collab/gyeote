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
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  })
  const parts = formatter.formatToParts(date)
  const values = Object.fromEntries(
    parts.filter((p) => p.type !== 'literal').map((p) => [p.type, p.value])
  )
  return values
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
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null
  return hour * 60 + minute
}

function isWithinSendWindow(currentHHmm: string) {
  const cur = hhmmToMinutes(currentHHmm)
  const start = hhmmToMinutes(SEND_START_HHMM)
  const end = hhmmToMinutes(SEND_END_HHMM)
  if (cur === null || start === null || end === null) return false
  return cur >= start && cur <= end
}

function createLunchMessage(parentName: string, todayMessage: string, hasMedication: boolean) {
  if (hasMedication) {
    return `${parentName}?? ?�심?� 챙겨 ?�셨?�요? ?��\n\n${todayMessage}\n\n?�늘 ?��? ?�셨?�요? ?��\n?��? ?��???건강??지켜드린답?�다.\n?��? 말고 �?챙겨 ?�세???��\n\n??�� ?�신 곁에 ?�을게요.\n- 곁에`
  }
  return `${parentName}?? ?�심?� 챙겨 ?�셨?�요? ?��\n\n${todayMessage}\n\n맛있??�??�시�??�후??건강?�게 보내?�요 ?��\n\n??�� ?�신 곁에 ?�을게요.\n- 곁에`
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
        message: `?�심 ?�림 ?�용 ?�간(${SEND_START_HHMM}~${SEND_END_HHMM}) 밖입?�다.`,
        currentKstHHmm,
      })
    }

    const parents = await prisma.parent.findMany({
      where: {
        isActive: true,
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

    const todayMessage = await generateTodayMessage()
    const results = []

    for (const parent of parents) {
      if (parent.responses.length > 0) {
        results.push({ parentId: parent.id, status: 'already_exists' })
        continue
      }

      const hasMedication = !!(parent as any).medication
      const message = createLunchMessage(parent.name, todayMessage, hasMedication)

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
        templateCode: hasMedication
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
          error: alimtalkResult.error ?? null,
          rawData: JSON.parse(JSON.stringify({ kind: 'LUNCH', ...alimtalkResult })),
        },
      })

      results.push({
        parentId: parent.id,
        parentName: parent.name,
        status: alimtalkResult.success ? 'sent' : 'failed',
      })
    }

    return NextResponse.json({ ok: true, currentKstHHmm, results })
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : '?�심 ?�론 ?�류' },
      { status: 500 }
    )
  }
}
