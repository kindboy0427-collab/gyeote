import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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

function parseLimit(value: string | null) {
  if (!value) {
    return 50
  }

  const parsed = Number(value)

  if (Number.isNaN(parsed)) {
    return 50
  }

  if (parsed < 1) {
    return 1
  }

  if (parsed > 100) {
    return 100
  }

  return parsed
}

export async function GET(request: NextRequest) {
  try {
    const adminSecret = process.env.ADMIN_SECRET

    if (!adminSecret) {
      return NextResponse.json(
        {
          ok: false,
          message: 'ADMIN_SECRET is not configured',
        },
        { status: 500 }
      )
    }

    const token = getBearerToken(request)

    if (!token || token !== adminSecret) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Unauthorized',
        },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)

    const limit = parseLimit(searchParams.get('limit'))
    const status = searchParams.get('status')
    const channel = searchParams.get('channel')
    const userId = searchParams.get('userId')
    const parentId = searchParams.get('parentId')
    const includeRaw = searchParams.get('includeRaw') === 'true'

    const where: {
      status?: string
      channel?: string
      userId?: string
      parentId?: string
    } = {}

    if (status) {
      where.status = status
    }

    if (channel) {
      where.channel = channel
    }

    if (userId) {
      where.userId = userId
    }

    if (parentId) {
      where.parentId = parentId
    }

    const logs = await prisma.notificationLog.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
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
            morningTime: true,
            isActive: true,
          },
        },
      },
    })

    return NextResponse.json({
      ok: true,
      count: logs.length,
      filters: {
        limit,
        status: status ?? null,
        channel: channel ?? null,
        userId: userId ?? null,
        parentId: parentId ?? null,
        includeRaw,
      },
      logs: logs.map((log) => ({
        id: log.id,
        userId: log.userId,
        parentId: log.parentId,
        channel: log.channel,
        status: log.status,
        message: log.message,
        error: log.error,
        rawData: includeRaw ? log.rawData : undefined,
        createdAt: log.createdAt,
        user: log.user
          ? {
              id: log.user.id,
              email: log.user.email,
              name: log.user.name,
            }
          : null,
        parent: log.parent
          ? {
              id: log.parent.id,
              name: log.parent.name,
              phone: log.parent.phone,
              morningTime: log.parent.morningTime,
              isActive: log.parent.isActive,
            }
          : null,
      })),
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : 'Unknown admin notification logs error',
      },
      { status: 500 }
    )
  }
}