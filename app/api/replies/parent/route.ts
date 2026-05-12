import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getTodayRange() {
  const now = new Date()

  const start = new Date(now)
  start.setHours(0, 0, 0, 0)

  const end = new Date(now)
  end.setHours(23, 59, 59, 999)

  return { start, end }
}

function normalizeMessage(message: unknown) {
  if (typeof message !== 'string') {
    return ''
  }

  return message.trim()
}

function normalizeParentId(parentId: unknown) {
  if (typeof parentId !== 'string') {
    return ''
  }

  return parentId.trim()
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)

    if (!body) {
      return NextResponse.json(
        {
          ok: false,
          message: '요청 본문이 없습니다.',
        },
        { status: 400 }
      )
    }

    const parentId = normalizeParentId(body.parentId)
    const message = normalizeMessage(body.message)

    if (!parentId) {
      return NextResponse.json(
        {
          ok: false,
          message: 'parentId가 필요합니다.',
        },
        { status: 400 }
      )
    }

    if (!message) {
      return NextResponse.json(
        {
          ok: false,
          message: '답장 내용이 필요합니다.',
        },
        { status: 400 }
      )
    }

    const parent = await prisma.parent.findUnique({
      where: {
        id: parentId,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        userId: true,
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

    const { start, end } = getTodayRange()

    const existingResponse = await prisma.response.findFirst({
      where: {
        parentId,
        type: 'morning',
        date: {
          gte: start,
          lte: end,
        },
      },
      orderBy: {
        date: 'desc',
      },
    })

    const response = existingResponse
      ? await prisma.response.update({
          where: {
            id: existingResponse.id,
          },
          data: {
            responded: true,
            respondedAt: new Date(),
            message,
          },
        })
      : await prisma.response.create({
          data: {
            parentId,
            responded: true,
            respondedAt: new Date(),
            message,
            type: 'morning',
          },
        })

    return NextResponse.json({
      ok: true,
      message: '부모님 답장이 저장되었습니다.',
      parent: {
        id: parent.id,
        name: parent.name,
        phone: parent.phone,
      },
      response,
    })
  } catch (error) {
    console.error('[PARENT_REPLY_POST_ERROR]', error)

    return NextResponse.json(
      {
        ok: false,
        message: '부모님 답장 저장 중 오류가 발생했습니다.',
      },
      { status: 500 }
    )
  }
}