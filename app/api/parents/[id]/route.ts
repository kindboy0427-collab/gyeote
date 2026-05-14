import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../src/lib/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const kakaoId = (session.user as { id?: string })?.id

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: `kakao_${kakaoId}@gyeote.com` },
        { email: session.user?.email ?? '' },
      ],
    },
  })

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const parent = await prisma.parent.findFirst({
    where: { id, userId: user.id },
  })

  if (!parent) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.response.deleteMany({ where: { parentId: id } })
  await prisma.message.deleteMany({ where: { parentId: id } })
  await prisma.report.deleteMany({ where: { parentId: id } })
  await prisma.notificationLog.updateMany({
    where: { parentId: id },
    data: { parentId: null },
  })
  await prisma.parent.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}