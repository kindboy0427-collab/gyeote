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