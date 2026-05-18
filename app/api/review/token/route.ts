import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/src/lib/auth'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
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
    include: { subscriptions: true },
  })

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 구독 이력 확인
  const hasSub = user.subscriptions.length > 0
  if (!hasSub) return NextResponse.json({ error: 'no-subscription' }, { status: 403 })

  const reviewToken = crypto.randomBytes(20).toString('hex')
  await prisma.user.update({
    where: { id: user.id },
    data: { reviewToken },
  })

  return NextResponse.json({ token: reviewToken, name: user.name ?? '' })
}