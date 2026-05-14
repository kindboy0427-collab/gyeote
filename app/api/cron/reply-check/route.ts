import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendKakaoAlimtalk } from '@/lib/kakao/alimtalk'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const KST_TIME_ZONE = 'Asia/Seoul'
const FOLLOW_UP_AFTER_HOURS = 2
const GUARDIAN_ALERT_AFTER_HOURS = 3

type ReplyCheckStatus =
  | 'no_response_yet'
  | 'follow_up_sent'
  | 'follow_up_failed'
  | 'follow_up_skipped'
  | 'follow_up_already_sent'
  | 'guardian_alert_required'
  | 'guardian_alert_already_logged'
  | 'responded'

function getBearerToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization')

  if (!authHeader) {
    return null
  }

  if (!authHeader.startsWith('Bearer ')) {
    return null
  }

  return authHeader.replace('Bearer ', '').trim()
}

function isCronAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    return true
  }

  const token = getBearerToken(request)

  return token === cronSecret
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
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
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

function getTodayKstRange() {
  const parts = getKstParts()

  const start = new Date(
    `${parts.year}-${parts.month}-${parts.day}T00:00:00.000+09:00`
  )

  const end = new Date(
    `${parts.year}-${parts.month}-${parts.day}T23:59:59.999+09:00`
  )

  return {
    start,
    end,
  }
}

function getElapsedHours(from: Date, to = new Date()) {
  return (to.getTime() - from.getTime()) / (60 * 60 * 1000)
}

function createFollowUpMessage(parentName: string) {
  return `${parentName}님, 아직 오늘 안부 답장이 확인되지 않았습니다. 괜찮으시면 짧게라도 답장해 주세요.`
}

function createGuardianAlertMessage(parentName: string) {
  return `${parentName}님이 오늘 안부 알림 후 3시간이 지나도록 답장하지 않았습니다. 확인이 필요합니다.`
}

function getLogStatus(statusText: 'sent' | 'failed' | 'skipped') {
  if (statusText === 'sent') {
    return 'sent'
  }

  if (statusText === 'skipped') {
    return 'skipped'
  }

  return 'failed'
}

function hasLogKind(
  logs: Array<{ rawData: unknown }>,
  responseId: string,
  kind: string
) {
  return logs.some((log) => {
    const rawData = log.rawData

    if (!rawData || typeof rawData !== 'object') {
      return false
    }

    const data = rawData as {
      responseId?: unknown
      kind?: unknown
    }

    return data.responseId === responseId && data.kind === kind
  })
}

export async function GET(request: NextRequest) {
  try {
    if (!isCronAuthorized(request)) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Unauthorized',
        },
        { status: 401 }
      )
    }

    const { start, end } = getTodayKstRange()

    const parents = await prisma.parent.findMany({
      where: {
        isActive: true,
        user: {
          subscriptions: {
            some: {
              status: 'active',
            },
          },
        },
      },
      include: {
        responses: {
          where: {
            type: 'morning',
            date: {
              gte: start,
              lte: end,
            },
          },
          orderBy: {
            date: 'desc',
          },
          take: 1,
        },
        notificationLogs: {
          where: {
            createdAt: {
              gte: start,
              lte: end,
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    })

    const results: Array<{
      parentId: string
      parentName: string
      phone: string
      responseId?: string
      elapsedHours?: number
      status: ReplyCheckStatus
      reason?: string
      error?: string
    }> = []

    for (const parent of parents) {
      const response = parent.responses[0]

      if (!response) {
        results.push({
          parentId: parent.id,
          parentName: parent.name,
          phone: parent.phone,
          status: 'no_response_yet',
          reason: '오늘 최초 안부 Response가 없습니다.',
        })

        continue
      }

      if (response.responded) {
        results.push({
          parentId: parent.id,
          parentName: parent.name,
          phone: parent.phone,
          responseId: response.id,
          status: 'responded',
          reason: '이미 답장 완료 상태입니다.',
        })

        continue
      }

      const elapsedHours = getElapsedHours(new Date(response.date))
      const followUpAlreadySent = hasLogKind(
        parent.notificationLogs,
        response.id,
        'MORNING_FOLLOW_UP'
      )
      const guardianAlertAlreadyLogged = hasLogKind(
        parent.notificationLogs,
        response.id,
        'GUARDIAN_ALERT_REQUIRED'
      )

      if (elapsedHours >= GUARDIAN_ALERT_AFTER_HOURS) {
        if (guardianAlertAlreadyLogged) {
          results.push({
            parentId: parent.id,
            parentName: parent.name,
            phone: parent.phone,
            responseId: response.id,
            elapsedHours,
            status: 'guardian_alert_already_logged',
            reason: '보호자 알림 필요 로그가 이미 있습니다.',
          })

          continue
        }

        const guardianMessage = createGuardianAlertMessage(parent.name)

        await prisma.notificationLog.create({
          data: {
            userId: parent.userId,
            parentId: parent.id,
            channel: 'GUARDIAN_ALERT',
            status: 'required',
            message: guardianMessage,
            error: null,
            rawData: {
              kind: 'GUARDIAN_ALERT_REQUIRED',
              responseId: response.id,
              parentName: parent.name,
              elapsedHours,
              reason:
                '최초 안부 알림톡 발송 후 3시간 초과 + 아직 답장 없음',
            },
          },
        })

        results.push({
          parentId: parent.id,
          parentName: parent.name,
          phone: parent.phone,
          responseId: response.id,
          elapsedHours,
          status: 'guardian_alert_required',
          reason: '최초 안부 후 3시간 초과 + 아직 답장 없음',
        })

        continue
      }

      if (elapsedHours >= FOLLOW_UP_AFTER_HOURS) {
        if (followUpAlreadySent) {
          results.push({
            parentId: parent.id,
            parentName: parent.name,
            phone: parent.phone,
            responseId: response.id,
            elapsedHours,
            status: 'follow_up_already_sent',
            reason: '추가 알림톡이 이미 1회 발송되었습니다.',
          })

          continue
        }

        const followUpMessage = createFollowUpMessage(parent.name)

        const alimtalkResult = await sendKakaoAlimtalk({
          to: parent.phone,
          parentName: parent.name,
          message: followUpMessage,
        })

        const logStatus = getLogStatus(alimtalkResult.statusText)

        await prisma.notificationLog.create({
          data: {
            userId: parent.userId,
            parentId: parent.id,
            channel: 'KAKAO_ALIMTALK',
            status: logStatus,
            message: followUpMessage,
            error: alimtalkResult.reason ?? alimtalkResult.error ?? null,
            rawData: {
              kind: 'MORNING_FOLLOW_UP',
              responseId: response.id,
              parentName: parent.name,
              elapsedHours,
              status: alimtalkResult.status,
              statusText: alimtalkResult.statusText,
              success: alimtalkResult.success,
              reason: alimtalkResult.reason ?? null,
              error: alimtalkResult.error ?? null,
              data: alimtalkResult.data ?? null,
            },
          },
        })

        if (alimtalkResult.statusText === 'skipped') {
          results.push({
            parentId: parent.id,
            parentName: parent.name,
            phone: parent.phone,
            responseId: response.id,
            elapsedHours,
            status: 'follow_up_skipped',
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
            responseId: response.id,
            elapsedHours,
            status: 'follow_up_failed',
            error: alimtalkResult.error ?? '추가 알림톡 발송 실패',
          })

          continue
        }

        results.push({
          parentId: parent.id,
          parentName: parent.name,
          phone: parent.phone,
          responseId: response.id,
          elapsedHours,
          status: 'follow_up_sent',
          reason: '최초 안부 후 2시간 초과 + 아직 답장 없음',
        })

        continue
      }

      results.push({
        parentId: parent.id,
        parentName: parent.name,
        phone: parent.phone,
        responseId: response.id,
        elapsedHours,
        status: 'no_response_yet',
        reason: '최초 안부 후 2시간 미만입니다.',
      })
    }

    const summary = {
      totalParents: parents.length,
      responded: results.filter((result) => result.status === 'responded')
        .length,
      noResponseYet: results.filter(
        (result) => result.status === 'no_response_yet'
      ).length,
      followUpSent: results.filter(
        (result) => result.status === 'follow_up_sent'
      ).length,
      followUpFailed: results.filter(
        (result) => result.status === 'follow_up_failed'
      ).length,
      followUpSkipped: results.filter(
        (result) => result.status === 'follow_up_skipped'
      ).length,
      followUpAlreadySent: results.filter(
        (result) => result.status === 'follow_up_already_sent'
      ).length,
      guardianAlertRequired: results.filter(
        (result) => result.status === 'guardian_alert_required'
      ).length,
      guardianAlertAlreadyLogged: results.filter(
        (result) => result.status === 'guardian_alert_already_logged'
      ).length,
    }

    return NextResponse.json({
      ok: true,
      checkedAt: new Date().toISOString(),
      timezone: KST_TIME_ZONE,
      summary,
      results,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : '답장 확인 Cron 처리 중 오류가 발생했습니다.',
      },
      { status: 500 }
    )
  }
}