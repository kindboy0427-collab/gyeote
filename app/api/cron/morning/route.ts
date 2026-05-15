import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  createMorningAlimtalkMessage,
  sendKakaoAlimtalk,
  generateTodayMessage,
} from '@/lib/kakao/alimtalk'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const KST_TIME_ZONE = 'Asia/Seoul'
const GLOBAL_SEND_START_HHMM = '09:00'
const GLOBAL_SEND_END_HHMM = '10:00'

type CronResultStatus =
  | 'sent'
  | 'failed'
  | 'skipped'
  | 'already_exists'
  | 'blocked_by_global_time_window'

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
  const values = Object.fromEntries(
    parts.filter((p) => p.type !== 'literal').map((p) => [p.type, p.value])
  )
  return { year: values.year, month: values.month, day: values.day, hour: values.hour, minute: values.minute, second: values.second }
}

function getCurrentKstHHmm() {
  const parts = getKstParts()
  return `${parts.hour}:${parts.minute}`
}

function getTodayKstRange() {
  const parts = getKstParts()
  const start = new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00.000+09:00`)
  const end = new Date(`${parts.year}-${parts.month}-${parts.day}T23:59:59.999+09:00`)
  return { start, end }
}

function hhmmToMinutes(hhmm: string) {
  const [hour, minute] = hhmm.split(':').map(Number)
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null
  return hour * 60 + minute
}

function isWithinGlobalKstSendWindow(currentHHmm: string) {
  const cur = hhmmToMinutes(currentHHmm)
  const start = hhmmToMinutes(GLOBAL_SEND_START_HHMM)
  const end = hhmmToMinutes(GLOBAL_SEND_END_HHMM)
  if (cur === null || start === null || end === null) return false
  return cur >= start && cur <= end
}

function getLogStatus(statusText: 'sent' | 'failed' | 'skipped') {
  if (statusText === 'sent') return 'sent'
  if (statusText === 'skipped') return 'skipped'
  return 'failed'
}

export async function GET(request: NextRequest) {
  try {
    if (!isCronAuthorized(request)) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 })
    }

    const forceRun = new URL(request.url).searchParams.get('force') === 'true'
    const { start, end } = getTodayKstRange()
    const currentKstHHmm = getCurrentKstHHmm()

    if (!forceRun && !isWithinGlobalKstSendWindow(currentKstHHmm)) {
      return NextResponse.json({
        ok: true,
        blocked: true,
        checkedAt: new Date().toISOString(),
        timezone: KST_TIME_ZONE,
        currentKstHHmm,
        allowedWindow: `${GLOBAL_SEND_START_HHMM}~${GLOBAL_SEND_END_HHMM}`,
        message: '한국시간 09:00~10:00 밖이므로 최초 안부 생성과 알림톡 발송을 차단했습니다.',
        summary: { totalParents: 0, sent: 0, failed: 0, skipped: 0, alreadyExists: 0, blockedByGlobalTimeWindow: 1 },
        results: [{ status: 'blocked_by_global_time_window', reason: `현재 한국시간 ${currentKstHHmm}, 허용 시간 ${GLOBAL_SEND_START_HHMM}~${GLOBAL_SEND_END_HHMM}` }],
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
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            subscriptions: {
              where: { status: { in: ['active', 'trial'] } },
              orderBy: { updatedAt: 'desc' },
              take: 1,
            },
          },
        },
        responses: {
          where: { date: { gte: start, lte: end }, type: 'morning' },
          take: 1,
        },
      },
    })

    const todayMessage = await generateTodayMessage()

    const results: Array<{
      parentId: string
      parentName: string
      phone: string
      status: CronResultStatus
      reason?: string
      error?: string
    }> = []

    for (const parent of parents) {
      if (parent.responses.length > 0) {
        results.push({ parentId: parent.id, parentName: parent.name, phone: parent.phone, status: 'already_exists', reason: '오늘 아침 안부 Response가 이미 생성되어 있습니다.' })
        continue
      }

      const message = createMorningAlimtalkMessage(parent.name, todayMessage)

      const response = await prisma.response.create({
        data: { parentId: parent.id, responded: false, message, type: 'morning' },
      })

      const alimtalkResult = await sendKakaoAlimtalk({
        to: parent.phone,
        parentName: parent.name,
        message,
        templateCode: process.env.KAKAO_ALIMTALK_TEMPLATE_CODE_MORNING,
      })

      const logStatus = getLogStatus(alimtalkResult.statusText)

      await prisma.notificationLog.create({
        data: {
          userId: parent.userId,
          parentId: parent.id,
          channel: 'KAKAO_ALIMTALK',
          status: logStatus,
          message,
          error: alimtalkResult.reason ?? alimtalkResult.error ?? null,
          rawData: JSON.parse(JSON.stringify({
            kind: 'MORNING_INITIAL',
            responseId: response.id,
            timezone: KST_TIME_ZONE,
            currentKstHHmm,
            status: alimtalkResult.status,
            statusText: alimtalkResult.statusText,
            success: alimtalkResult.success,
            error: alimtalkResult.error ?? null,
            data: alimtalkResult.data ?? null,
          })),
        },
      })

      if (alimtalkResult.statusText === 'skipped') {
        results.push({ parentId: parent.id, parentName: parent.name, phone: parent.phone, status: 'skipped', reason: alimtalkResult.reason ?? 'ALIMTALK_NOT_CONFIGURED', error: alimtalkResult.error })
        continue
      }

      if (!alimtalkResult.success) {
        results.push({ parentId: parent.id, parentName: parent.name, phone: parent.phone, status: 'failed', error: alimtalkResult.error ?? '카카오 알림톡 발송 실패' })
        continue
      }

      results.push({ parentId: parent.id, parentName: parent.name, phone: parent.phone, status: 'sent' })
    }

    const summary = {
      totalParents: parents.length,
      sent: results.filter((r) => r.status === 'sent').length,
      failed: results.filter((r) => r.status === 'failed').length,
      skipped: results.filter((r) => r.status === 'skipped').length,
      alreadyExists: results.filter((r) => r.status === 'already_exists').length,
      blockedByGlobalTimeWindow: results.filter((r) => r.status === 'blocked_by_global_time_window').length,
    }

    return NextResponse.json({ ok: true, checkedAt: new Date().toISOString(), timezone: KST_TIME_ZONE, currentKstHHmm, allowedWindow: `${GLOBAL_SEND_START_HHMM}~${GLOBAL_SEND_END_HHMM}`, summary, results })
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : '아침 안부 Cron 처리 중 오류가 발생했습니다.' }, { status: 500 })
  }
}