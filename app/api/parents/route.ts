import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../src/lib/auth'
import { prisma } from '../../../src/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)

  const kakaoId = session?.user?.id
  if (!kakaoId) {
    return NextResponse.json({ error: '로그인 필요' }, { status: 401 })
  }

  const { name, phone, morningTime, medication } = await req.json()

  try {
    const user = await prisma.user.upsert({
      where: { email: `kakao_${kakaoId}@gyeote.com` },
      update: {},
      create: {
        email: `kakao_${kakaoId}@gyeote.com`,
        name: session.user?.name ?? '사용자',
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
    console.error('등록 에러:', e)
    return NextResponse.json({ error: '등록 실패', detail: String(e) }, { status: 500 })
  }
}