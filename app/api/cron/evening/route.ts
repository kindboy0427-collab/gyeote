import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateTodayMessage, sendKakaoAlimtalk } from '@/lib/kakao/alimtalk'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const KST_TIME_ZONE = 'Asia/Seoul'
const SEND_START_HHMM = '18:00'
const SEND_END_HHMM = '19:00'

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
  return Object.fromEntries(
    parts.filter((p) => p.type !== 'literal').map((p) => [p.type, p.value])
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

function isFriday() {
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: KST_TIME_ZONE, weekday: 'long' })
  return formatter.format(new Date()) === 'Friday'
}

function isWeekendKst(): boolean {
  const day = new Date().toLocaleDateString('en-US', { timeZone: KST_TIME_ZONE, weekday: 'long' })
  return day === 'Saturday' || day === 'Sunday'
}

function createEveningMessage(parentName: string, todayMessage: string) {
  return `${parentName}님, 오늘 하루도 수고 많으셨어요 🌙\n\n${todayMessage}\n\n오늘 저녁은 따뜻하게 챙겨드세요.\n\n항상 응원 곁에 있을게요.\n- 곁에`
}

function createFridayEveningMessage(parentName: string, todayMessage: string) {
  return `${parentName}님, 한 주도 수고 많으셨어요 🌙\n\n${todayMessage}\n\n이번 한 주는 어떠셨나요?\n자녀에게 전하고 싶은 말이 있으시면 아래 버튼을 눌러 마음을 전해보세요 💌\n\n항상 곁에 있을게요.\n- 곁에`
}

export async function GET(request: NextRequest) {
  try {
    if (!isCronAuthorized(request)) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 })
    }

    const forceRun = new URL(request.url).searchParams.get('force') === 'true'
    const forceFriday = new URL(request.url).searchParams.get('friday') === 'true'
    const friday = forceFriday || isFriday()

    if (!forceRun && isWeekendKst()) {
      return NextResponse.json({ ok: true, blocked: true, message: '주말에는 발송하지 않습니다.' })
    }

    const currentKstHHmm = getCurrentKstHHmm()
    const { start, end } = getTodayKstRange()

    if (!forceRun && !isWithinSendWindow(currentKstHHmm)) {
      return NextResponse.json({
        ok: true,
        blocked: true,
        message: `발송 시간 범위(${SEND_START_HHMM}~${SEND_END_HHMM}) 외입니다.`,
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
          where: { date: { gte: start, lte: end }, type: 'evening' },
          take: 1,
        },
      },
    })

    const todayMessage = await generateTodayMessage('evening')
    const results = []

    for (const parent of parents) {
      if (parent.responses.length > 0) {
        results.push({ parentId: parent.id, status: 'already_exists' })
        continue
      }

      const message = friday
        ? createFridayEveningMessage(parent.name, todayMessage)
        : createEveningMessage(parent.name, todayMessage)

      const templateCode = friday
        ? process.env.KAKAO_ALIMTALK_TEMPLATE_CODE_EVENING_FRIDAY
        : process.env.KAKAO_ALIMTALK_TEMPLATE_CODE_EVENING

      const newResponse = await prisma.response.create({
        data: { parentId: parent.id, responded: false, message, type: 'evening' },
      })

      const linkUrl = friday
        ? `https://gyeote-eight.vercel.app/message/${newResponse.id}`
        : undefined

      const alimtalkResult = await sendKakaoAlimtalk({
        to: parent.phone,
        parentName: parent.name,
        message: todayMessage,
        templateCode,
        linkUrl,
      })

      await prisma.notificationLog.create({
        data: {
          userId: parent.userId,
          parentId: parent.id,
          channel: 'KAKAO_ALIMTALK',
          status: alimtalkResult.success ? 'sent' : 'failed',
          message,
          error: alimtalkResult.error ?? null,
          rawData: JSON.parse(JSON.stringify({ kind: friday ? 'EVENING_FRIDAY' : 'EVENING', linkUrl, ...alimtalkResult })),
        },
      })

      results.push({
        parentId: parent.id,
        parentName: parent.name,
        status: alimtalkResult.success ? 'sent' : 'failed',
        type: friday ? 'friday' : 'weekday',
        linkUrl,
      })
    }

    return NextResponse.json({ ok: true, currentKstHHmm, friday, results })
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : '저녁 Cron 오류' },
      { status: 500 }
    )
  }
}