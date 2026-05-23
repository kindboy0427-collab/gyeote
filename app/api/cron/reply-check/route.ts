import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendKakaoAlimtalk } from '@/lib/kakao/alimtalk'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const KST_TIME_ZONE = 'Asia/Seoul'
const FOLLOW_UP_AFTER_HOURS = 2
const GUARDIAN_ALERT_AFTER_HOURS = 3
const GUARDIAN_ALERT_AFTER_FOLLOW_UP_HOURS = 1

type ReplyCheckStatus =
  | 'no_response_yet'
  | 'follow_up_sent'
  | 'follow_up_failed'
  | 'follow_up_skipped'
  | 'follow_up_already_sent'
  | 'guardian_alert_sent'
  | 'guardian_alert_failed'
  | 'guardian_alert_skipped'
  | 'guardian_alert_already_sent'
  | 'guardian_phone_missing'
  | 'responded'

type NotificationLogForCheck = {
  rawData: unknown
  createdAt: Date
}

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
  const start = new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00.000+09:00`)
  const end = new Date(`${parts.year}-${parts.month}-${parts.day}T23:59:59.999+09:00`)
  return { start, end }
}

function getElapsedHours(from: Date, to = new Date()) {
  return (to.getTime() - from.getTime()) / (60 * 60 * 1000)
}

function createFollowUpMessage(parentName: string) {
  return `${parentName}님, 아직 오늘 안부 답장을 확인하지 못했어요.

괜찮으시면 짧게라도 답장해 주세요.

항상 곁에 있을게요.
- 곁에`
}

function createGuardianAlertMessage(parentName: string) {
  return `${parentName} 부모님께서 오늘 아침 안부에 3시간이 동안 응답하지 않으셨어요.

아무일 없으시겠지만
시간이 되실 때 연락해 보시는 건 어떨까요? 🙏

- 곁에`
}

function getLogStatus(statusText: 'sent' | 'failed' | 'skipped') {
  if (statusText === 'sent') return 'sent'
  if (statusText === 'skipped') return 'skipped'
  return 'failed'
}

function findLogByKind(
  logs: NotificationLogForCheck[],
  responseId: string,
  kind: string
) {
  return logs.find((log) => {
    const rawData = log.rawData
    if (!rawData || typeof rawData !== 'object') return false
    const data = rawData as { responseId?: unknown; kind?: unknown }
    return data.responseId === responseId && data.kind === kind
  })
}

export async function GET(request: NextRequest) {
  try {
    if (!isCronAuthorized(request)) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 })
    }

    const { start, end } = getTodayKstRange()

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
            guardianPhone: true,
          },
        },
        responses: {
          where: {
            type: 'morning',
            date: { gte: start, lte: end },
          },
          orderBy: { date: 'desc' },
          take: 1,
        },
        notificationLogs: {
          where: { createdAt: { gte: start, lte: end } },
          orderBy: { createdAt: 'desc' },
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
          reason: '오늘 최초 아침 Response가 없습니다.',
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
          reason: '오늘 답장 완료 상태입니다.',
        })
        continue
      }

      const elapsedHours = getElapsedHours(new Date(response.date))

      const followUpLog = findLogByKind(
        parent.notificationLogs,
        response.id,
        'MORNING_FOLLOW_UP'
      )

      const guardianAlertLog = findLogByKind(
        parent.notificationLogs,
        response.id,
        'GUARDIAN_ALERT_SENT'
      )

      if (elapsedHours >= FOLLOW_UP_AFTER_HOURS && !followUpLog) {
        const followUpMessage = createFollowUpMessage(parent.name)

        const alimtalkResult = await sendKakaoAlimtalk({
          to: parent.phone,
          parentName: parent.name,
          message: followUpMessage,
          templateCode: process.env.KAKAO_ALIMTALK_TEMPLATE_CODE_MORNING_FOLLOW_UP,
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
          reason: '최초 아침 알림 후 2시간 무응답으로 부모님 추가 알림 1회 발송',
        })
        continue
      }

      if (followUpLog && elapsedHours < GUARDIAN_ALERT_AFTER_HOURS) {
        results.push({
          parentId: parent.id,
          parentName: parent.name,
          phone: parent.phone,
          responseId: response.id,
          elapsedHours,
          status: 'follow_up_already_sent',
          reason: '부모님 추가 알림은 이미 발송됐고, 아직 3시간 무응답 기준 전입니다.',
        })
        continue
      }

      if (followUpLog && elapsedHours >= GUARDIAN_ALERT_AFTER_HOURS) {
        const elapsedAfterFollowUpHours = getElapsedHours(new Date(followUpLog.createdAt))

        if (elapsedAfterFollowUpHours < GUARDIAN_ALERT_AFTER_FOLLOW_UP_HOURS) {
          results.push({
            parentId: parent.id,
            parentName: parent.name,
            phone: parent.phone,
            responseId: response.id,
            elapsedHours,
            status: 'follow_up_already_sent',
            reason: '부모님 추가 알림 후 아직 1시간이 지나지 않았습니다.',
          })
          continue
        }

        if (guardianAlertLog) {
          results.push({
            parentId: parent.id,
            parentName: parent.name,
            phone: parent.phone,
            responseId: response.id,
            elapsedHours,
            status: 'guardian_alert_already_sent',
            reason: '보호자 카톡 알림이 이미 발송됐습니다.',
          })
          continue
        }

        if (!parent.user.guardianPhone) {
          const guardianMessage = createGuardianAlertMessage(parent.name)

          await prisma.notificationLog.create({
            data: {
              userId: parent.userId,
              parentId: parent.id,
              channel: 'GUARDIAN_ALERT',
              status: 'guardian_phone_missing',
              message: guardianMessage,
              error: '보호자 전화번호가 등록되어 있지 않습니다.',
              rawData: {
                kind: 'GUARDIAN_PHONE_MISSING',
                responseId: response.id,
                parentName: parent.name,
                elapsedHours,
                elapsedAfterFollowUpHours,
              },
            },
          })

          results.push({
            parentId: parent.id,
            parentName: parent.name,
            phone: parent.phone,
            responseId: response.id,
            elapsedHours,
            status: 'guardian_phone_missing',
            reason: '보호자 전화번호가 등록되어 있지 않습니다.',
          })
          continue
        }

        const guardianMessage = createGuardianAlertMessage(parent.name)

        const guardianAlimtalkResult = await sendKakaoAlimtalk({
          to: parent.user.guardianPhone,
          parentName: parent.user.name ?? '자녀',
          message: guardianMessage,
          templateCode: process.env.KAKAO_ALIMTALK_TEMPLATE_CODE_GUARDIAN_ALERT,
          extraVariables: {
            '#{자녀이름}': parent.user.name ?? '자녀',
            '#{부모님이름}': parent.name,
          },
        })

        const guardianLogStatus = getLogStatus(guardianAlimtalkResult.statusText)

        await prisma.notificationLog.create({
          data: {
            userId: parent.userId,
            parentId: parent.id,
            channel: 'GUARDIAN_ALERT',
            status: guardianLogStatus,
            message: guardianMessage,
            error: guardianAlimtalkResult.reason ?? guardianAlimtalkResult.error ?? null,
            rawData: {
              kind: 'GUARDIAN_ALERT_SENT',
              responseId: response.id,
              parentName: parent.name,
              guardianPhone: parent.user.guardianPhone,
              elapsedHours,
              elapsedAfterFollowUpHours,
              status: guardianAlimtalkResult.status,
              statusText: guardianAlimtalkResult.statusText,
              success: guardianAlimtalkResult.success,
              reason: guardianAlimtalkResult.reason ?? null,
              error: guardianAlimtalkResult.error ?? null,
              data: guardianAlimtalkResult.data ?? null,
            },
          },
        })

        if (guardianAlimtalkResult.statusText === 'skipped') {
          results.push({
            parentId: parent.id,
            parentName: parent.name,
            phone: parent.phone,
            responseId: response.id,
            elapsedHours,
            status: 'guardian_alert_skipped',
            reason: guardianAlimtalkResult.reason ?? 'GUARDIAN_ALERT_ALIMTALK_NOT_CONFIGURED',
            error: guardianAlimtalkResult.error,
          })
          continue
        }

        if (!guardianAlimtalkResult.success) {
          results.push({
            parentId: parent.id,
            parentName: parent.name,
            phone: parent.phone,
            responseId: response.id,
            elapsedHours,
            status: 'guardian_alert_failed',
            error: guardianAlimtalkResult.error ?? '보호자 카카오 알림톡 발송 실패',
          })
          continue
        }

        results.push({
          parentId: parent.id,
          parentName: parent.name,
          phone: parent.phone,
          responseId: response.id,
          elapsedHours,
          status: 'guardian_alert_sent',
          reason: '최초 아침 알림 후 3시간 무응답 + 부모님 추가 알림 후 1시간 무응답으로 보호자 카톡 발송',
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
        reason: '최초 아침 알림 후 2시간 미만입니다.',
      })
    }

    const summary = {
      totalParents: parents.length,
      responded: results.filter((r) => r.status === 'responded').length,
      noResponseYet: results.filter((r) => r.status === 'no_response_yet').length,
      followUpSent: results.filter((r) => r.status === 'follow_up_sent').length,
      followUpFailed: results.filter((r) => r.status === 'follow_up_failed').length,
      followUpSkipped: results.filter((r) => r.status === 'follow_up_skipped').length,
      followUpAlreadySent: results.filter((r) => r.status === 'follow_up_already_sent').length,
      guardianAlertSent: results.filter((r) => r.status === 'guardian_alert_sent').length,
      guardianAlertFailed: results.filter((r) => r.status === 'guardian_alert_failed').length,
      guardianAlertSkipped: results.filter((r) => r.status === 'guardian_alert_skipped').length,
      guardianAlertAlreadySent: results.filter((r) => r.status === 'guardian_alert_already_sent').length,
      guardianPhoneMissing: results.filter((r) => r.status === 'guardian_phone_missing').length,
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
        message: error instanceof Error ? error.message : '답장 확인 Cron 처리 중 오류가 발생했습니다.',
      },
      { status: 500 }
    )
  }
}