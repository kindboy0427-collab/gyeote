import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../src/lib/auth'
import { prisma } from '@/lib/prisma'

const BETA_CODE = 'GYEOTE2026'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const kakaoId = (session.user as { id?: string })?.id

  const { code } = await req.json()

  if (!code || code.toUpperCase() !== BETA_CODE) {
    return NextResponse.json({ error: '유효하지 않은 초대 코드입니다.' }, { status: 400 })
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: `kakao_${kakaoId}@gyeote.com` },
        { email: session.user?.email ?? '' },
      ],
    },
    include: { subscriptions: true },
  })

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const existing = user.subscriptions.find(
    (s) => s.status === 'trial' || s.status === 'active'
  )
  if (existing) return NextResponse.json({ error: '이미 구독 중이거나 체험을 사용했습니다.' }, { status: 400 })

  const trialEnd = new Date()
  trialEnd.setDate(trialEnd.getDate() + 7)

  const subscription = await prisma.subscription.create({
    data: {
      userId: user.id,
      plan: 'monthly',
      provider: 'TRIAL',
      status: 'trial',
      price: 0,
      nextBillingAt: trialEnd,
    },
  })

  return NextResponse.json({ ok: true, subscription })
}