import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../src/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST() {
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

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const existing = user.subscriptions.find(
    (s) => s.status === 'trial' || s.status === 'active'
  )
  if (existing) return NextResponse.json({ error: 'Already subscribed' }, { status: 400 })

  const trialEnd = new Date()
  trialEnd.setDate(trialEnd.getDate() + 30)

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