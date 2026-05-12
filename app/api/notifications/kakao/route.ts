import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  createMorningAlimtalkMessage,
  sendKakaoAlimtalk,
} from '@/lib/kakao/alimtalk'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type KakaoNotificationRequestBody = {
  parentId?: string
  userId?: string
  to?: string
  parentName?: string
  message?: string
  templateCode?: string
}

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

function isAdminAuthorized(request: NextRequest) {
  const adminSecret = process.env.ADMIN_SECRET

  if (!adminSecret) {
    return true
  }

  const token = getBearerToken(request)

  return token === adminSecret
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
    if (!isAdminAuthorized(request)) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Unauthorized',
        },
        { status: 401 }
      )
    }

    const recentLogs = await prisma.notificationLog.findMany({
      where: {
        channel: 'KAKAO_ALIMTALK',
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 20,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        parent: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
      },
    })

    return NextResponse.json({
      ok: true,
      count: recentLogs.length,
      logs: recentLogs,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : '카카오 알림톡 로그 조회 중 오류가 발생했습니다.',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isAdminAuthorized(request)) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Unauthorized',
        },
        { status: 401 }
      )
    }

    const body = (await request.json().catch(() => ({}))) as
      | KakaoNotificationRequestBody
      | undefined

    const parentId = body?.parentId
    const directTo = body?.to
    const directParentName = body?.parentName
    const directMessage = body?.message
    const templateCode = body?.templateCode

    let parent:
      | {
          id: string
          userId: string
          name: string
          phone: string
        }
      | null = null

    if (parentId) {
      parent = await prisma.parent.findUnique({
        where: {
          id: parentId,
        },
        select: {
          id: true,
          userId: true,
          name: true,
          phone: true,
        },
      })

      if (!parent) {
        return NextResponse.json(
          {
            ok: false,
            message: '부모님 정보를 찾을 수 없습니다.',
          },
          { status: 404 }
        )
      }
    }

    const to = parent?.phone ?? directTo
    const parentName = parent?.name ?? directParentName

    if (!to || !parentName) {
      return NextResponse.json(
        {
          ok: false,
          message:
            'parentId 또는 to, parentName 값이 필요합니다.',
        },
        { status: 400 }
      )
    }

    const message =
      directMessage ?? createMorningAlimtalkMessage(parentName)

    const result = await sendKakaoAlimtalk({
      to,
      parentName,
      message,
      templateCode,
    })

    const logStatus = getLogStatus(result.statusText)

    await prisma.notificationLog.create({
      data: {
        userId: parent?.userId ?? body?.userId ?? null,
        parentId: parent?.id ?? parentId ?? null,
        channel: 'KAKAO_ALIMTALK',
        status: logStatus,
        message,
        error:
          result.reason ??
          result.error ??
          null,
        rawData: {
          status: result.status,
          statusText: result.statusText,
          success: result.success,
          reason: result.reason ?? null,
          error: result.error ?? null,
          data: result.data ?? null,
        },
      },
    })

    if (result.statusText === 'skipped') {
      return NextResponse.json({
        ok: true,
        sent: false,
        skipped: true,
        reason: result.reason ?? 'ALIMTALK_NOT_CONFIGURED',
        message:
          '카카오 알림톡 설정값이 없어 발송을 건너뛰었습니다.',
        result,
      })
    }

    if (!result.success) {
      return NextResponse.json(
        {
          ok: false,
          sent: false,
          skipped: false,
          message: result.error ?? '카카오 알림톡 발송에 실패했습니다.',
          result,
        },
        { status: 502 }
      )
    }

    return NextResponse.json({
      ok: true,
      sent: true,
      skipped: false,
      message: '카카오 알림톡 발송 요청이 완료되었습니다.',
      result,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : '카카오 알림톡 발송 API 처리 중 오류가 발생했습니다.',
      },
      { status: 500 }
    )
  }
}