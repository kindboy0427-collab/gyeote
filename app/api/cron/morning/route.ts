import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  createMorningAlimtalkMessage,
  sendKakaoAlimtalk,
} from '@/lib/kakao/alimtalk'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

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

function getTodayRange() {
  const now = new Date()

  const start = new Date(now)
  start.setHours(0, 0, 0, 0)

  const end = new Date(now)
  end.setHours(23, 59, 59, 999)

  return {
    start,
    end,
  }
}

function getCurrentHHmm() {
  const now = new Date()

  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')

  return `${hours}:${minutes}`
}

function isWithinMorningWindow(parentMorningTime: string, currentHHmm: string) {
  if (!parentMorningTime) {
    return true
  }

  const [targetHour, targetMinute] = parentMorningTime
    .split(':')
    .map((value) => Number(value))

  const [currentHour, currentMinute] = currentHHmm
    .split(':')
    .map((value) => Number(value))

  if (
    Number.isNaN(targetHour) ||
    Number.isNaN(targetMinute) ||
    Number.isNaN(currentHour) ||
    Number.isNaN(currentMinute)
  ) {
    return true
  }

  const targetTotalMinutes = targetHour * 60 + targetMinute
  const currentTotalMinutes = currentHour * 60 + currentMinute

  const diff = Math.abs(currentTotalMinutes - targetTotalMinutes)

  return diff <= 90
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

    const { start, end } = getTodayRange()
    const currentHHmm = getCurrentHHmm()

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
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            subscriptions: {
              where: {
                status: 'active',
              },
              orderBy: {
                updatedAt: 'desc',
              },
              take: 1,
            },
          },
        },
        responses: {
          where: {
            date: {
              gte: start,
              lte: end,
            },
            type: 'morning',
          },
          take: 1,
        },
      },
    })

    const results: Array<{
      parentId: string
      parentName: string
      phone: string
      status: 'sent' | 'failed' | 'skipped' | 'already_exists' | 'outside_time_window'
      reason?: string
      error?: string
    }> = []

    for (const parent of parents) {
      if (!isWithinMorningWindow(parent.morningTime, currentHHmm)) {
        results.push({
          parentId: parent.id,
          parentName: parent.name,
          phone: parent.phone,
          status: 'outside_time_window',
          reason: `현재 시간 ${currentHHmm}, 설정 시간 ${parent.morningTime}`,
        })

        continue
      }

      const alreadyCreated = parent.responses.length > 0

      if (alreadyCreated) {
        results.push({
          parentId: parent.id,
          parentName: parent.name,
          phone: parent.phone,
          status: 'already_exists',
          reason: '오늘 아침 안부 Response가 이미 생성되어 있습니다.',
        })

        continue
      }

      const message = createMorningAlimtalkMessage(parent.name)

      const response = await prisma.response.create({
        data: {
          parentId: parent.id,
          responded: false,
          message,
          type: 'morning',
        },
      })

      const alimtalkResult = await sendKakaoAlimtalk({
        to: parent.phone,
        parentName: parent.name,
        message,
      })

      const logStatus = getLogStatus(alimtalkResult.statusText)

      await prisma.notificationLog.create({
        data: {
          userId: parent.userId,
          parentId: parent.id,
          channel: 'KAKAO_ALIMTALK',
          status: logStatus,
          message,
          error:
            alimtalkResult.reason ??
            alimtalkResult.error ??
            null,
          rawData: {
            responseId: response.id,
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
          error: alimtalkResult.error ?? '카카오 알림톡 발송 실패',
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
      sent: results.filter((result) => result.status === 'sent').length,
      failed: results.filter((result) => result.status === 'failed').length,
      skipped: results.filter((result) => result.status === 'skipped').length,
      alreadyExists: results.filter(
        (result) => result.status === 'already_exists'
      ).length,
      outsideTimeWindow: results.filter(
        (result) => result.status === 'outside_time_window'
      ).length,
    }

    return NextResponse.json({
      ok: true,
      checkedAt: new Date().toISOString(),
      currentHHmm,
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
            : '아침 안부 Cron 처리 중 오류가 발생했습니다.',
      },
      { status: 500 }
    )
  }
}