import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../src/lib/auth'
import { prisma } from '../../../src/lib/prisma'
import { sendKakaoAlimtalk } from '../../../lib/kakao/alimtalk'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const kakaoId = (session?.user as any)?.id

  if (!kakaoId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { name, phone, morningTime } = await req.json()

  try {
    const user = await prisma.user.upsert({
      where: { email: session?.user?.email ?? `kakao_${kakaoId}@gyeote.com` },
      update: {},
      create: {
        email: session?.user?.email ?? `kakao_${kakaoId}@gyeote.com`,
        name: session?.user?.name ?? 'user',
      },
    })

    const parentCount = await prisma.parent.count({
      where: { userId: user.id },
    })

    if (parentCount >= 2) {
      return NextResponse.json(
        { error: '부모님은 최대 2명까지만 등록할 수 있습니다.' },
        { status: 400 }
      )
    }

    const parent = await prisma.parent.create({
      data: {
        userId: user.id,
        name,
        phone,
        morningTime: morningTime ?? '09:00',
        isActive: true,
      },
    })

    const welcomeMessage = `${name}님, 안녕하세요 🌿\n\n자녀분께서 곁에 서비스를 통해\n매일 아침 안부 확인을 시작했어요.\n\n내일 아침부터 매일 안부 메시지를 보내드릴게요.\n아래 버튼을 눌러 채널을 추가하시면\n더 편하게 이용하실 수 있어요.\n\n항상 곁에 있을게요.\n- 곁에`

    await sendKakaoAlimtalk({
      to: phone,
      parentName: name,
      message: welcomeMessage,
      templateCode: process.env.KAKAO_ALIMTALK_TEMPLATE_CODE_WELCOME,
    }).catch((e) => console.error('welcome alimtalk error:', e))

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
      where: { email: session?.user?.email ?? `kakao_${kakaoId}@gyeote.com` },
      include: { parents: true },
    })

    return NextResponse.json({ parents: user?.parents ?? [] })
  } catch (e) {
    return NextResponse.json({ error: 'Failed', detail: String(e) }, { status: 500 })
  }
}