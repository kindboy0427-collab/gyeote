import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/src/lib/auth'
import { prisma } from '@/lib/prisma'

const ADMIN_KAKAO_ID = '4887737362'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const kakaoId = (session?.user as { id?: string })?.id

  if (kakaoId !== ADMIN_KAKAO_ID) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await req.formData()
  const subscriptionId = formData.get('subscriptionId') as string
  const days = parseInt(formData.get('days') as string)

  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
  })

  if (!subscription) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const current = subscription.nextBillingAt ?? new Date()
  const newDate = new Date(current)
  newDate.setDate(newDate.getDate() + days)

  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: { nextBillingAt: newDate },
  })

  return NextResponse.redirect(new URL('/admin', req.url))
}