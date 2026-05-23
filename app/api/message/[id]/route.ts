import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendPushToUser } from '@/src/lib/push'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { message } = await request.json()

    if (!message?.trim()) {
      return NextResponse.json({ error: '메시지를 입력해주세요' }, { status: 400 })
    }

    const response = await prisma.response.findUnique({
      where: { id },
      include: {
        parent: {
          include: {
            user: true,
          },
        },
      },
    })

    if (!response) {
      return NextResponse.json({ error: '유효하지 않은 링크입니다' }, { status: 404 })
    }

    const userId = response.parent.userId
    const parentName = response.parent.name

    await sendPushToUser(
      userId,
      `${parentName}님의 마음 💌`,
      message.trim()
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '오류가 발생했습니다' },
      { status: 500 }
    )
  }
}