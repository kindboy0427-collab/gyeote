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

type CronResultStatus =
  | 'sent'
  | 'failed'
  | 'skipped'
  | 'already_exists'
  | 'not_yet'

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
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  }
}

function getCurrentKstHHmm() {
  const parts = getKstParts()
  return `${parts.hour}:${parts.minute}`
}

function getCurrentKstHour() {
  const parts = getKstParts()
  return parts.hour // "09", "10" ??
}

function getTodayKstRange() {
  const parts = getKstParts()
  const start = new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00.000+09:00`)
  const end = new Date(`${parts.year}-${parts.month}-${parts.day}T23:59:59.999+09:00`)
  return { start, end }
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
    const currentKstHour = getCurrentKstHour() // "09"

    // ?�재 KST ?�간(??�?morningTime??????가 같�? 부모님�?조회
    const parents = await prisma.parent.findMany({
      where: {
        isActive: true,
        // morningTime???�재 ?�간?�?� ?�치?�는 부모님�?
        // ?? ?�재 09?�면 "09:00", "09:30" ???��? ?�함
        morningTime: {
          startsWith: currentKstHour + ':',
        },
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

    if (parents.length === 0) {
      return NextResponse.json({
        ok: true,
        checkedAt: new Date().toISOString(),
        timezone: KST_TIME_ZONE,
        currentKstHHmm,
        message: `?�재 ?�간(${currentKstHHmm})??발송??부모님???�습?�다.`,
        summary: { totalParents: 0, sent: 0, failed: 0, skipped: 0 },
        results: [],
      })
    }

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
      // ?�늘 ?��? 발송?�으�??�킵
      if (parent.responses.length > 0) {
        results.push({
          parentId: parent.id,
          parentName: parent.name,
          phone: parent.phone,
          status: 'already_exists',
          reason: '?�늘 ?��? 발송??,
        })
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
            morningTime: parent.morningTime,
            status: alimtalkResult.status,
            statusText: alimtalkResult.statusText,
            success: alimtalkResult.success,
            error: alimtalkResult.error ?? null,
            data: alimtalkResult.data ?? null,
          })),
        },
      })

      if (alimtalkResult.statusText === 'skipped') {
        results.push({
          parentId: parent.id,
          parentName: parent.name,
          phone: parent.phone,
          status: 'skipped',
          reason: alimtalkResult.reason ?? 'ALIMTALK_NOT_CONFIGURED',
          error: alimtalkResult.error,
        })
        continue
      }

      if (!alimtalkResult.success) {
        results.push({
          parentId: parent.id,
          parentName: parent.name,
          phone: parent.phone,
          status: 'failed',
          error: alimtalkResult.error ?? '?�림??발송 ?�패',
        })
        continue
      }

      results.push({
        parentId: parent.id,
        parentName: parent.name,
        phone: parent.phone,
        status: 'sent',
      })
    }

    const summary = {
      totalParents: parents.length,
      sent: results.filter((r) => r.status === 'sent').length,
      failed: results.filter((r) => r.status === 'failed').length,
      skipped: results.filter((r) => r.status === 'skipped').length,
      alreadyExists: results.filter((r) => r.status === 'already_exists').length,
    }

    return NextResponse.json({
      ok: true,
      checkedAt: new Date().toISOString(),
      timezone: KST_TIME_ZONE,
      currentKstHHmm,
      summary,
      results,
    })
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : '?????�는 ?�류' },
      { status: 500 }
    )
  }
}
