import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../src/lib/auth'
import { prisma } from '../../../src/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const kakaoId = (session?.user as any)?.id

  if (!kakaoId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { name, phone, morningTime, medication } = await req.json()

  try {
    const user = await prisma.user.upsert({
      where: { email: `kakao_${kakaoId}@gyeote.com` },
      update: {},
      create: {
        email: `kakao_${kakaoId}@gyeote.com`,
        name: session?.user?.name ?? 'user',
      },
    })

    const parent = await prisma.parent.create({
      data: {
        userId: user.id,
        name,
        phone,
        morningTime: morningTime ?? '09:00',
        isActive: true,
      },
    })

    // 첫 부모님 등록 시 trial 구독 자동 생성
    const existingSub = await prisma.subscription.findFirst({
      where: { userId: user.id },
    })

    if (!existingSub) {
      const trialEnd = new Date()
      trialEnd.setDate(trialEnd.getDate() + 30)

      await prisma.subscription.create({
        data: {
          userId: user.id,
          plan: 'monthly',
          provider: 'TRIAL',
          status: 'trial',
          price: 0,
          nextBillingAt: trialEnd,
        },
      })
    }

    return NextResponse.json({ success: true, parent })
  } catch (e) {
    console.error('error:', e)
    return NextResponse.json({ error: 'Failed', detail: String(e) }, { status: 500 })
  }
}

export async function GET() {
  const session = await getServerSession(authOptions)
  const kakaoId = (session?.user as any)?.id

  if (!kakaoId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: `kakao_${kakaoId}@gyeote.com` },
      include: { parents: true },
    })

    return NextResponse.json({ parents: user?.parents ?? [] })
  } catch (e) {
    return NextResponse.json({ error: 'Failed', detail: String(e) }, { status: 500 })
  }
}