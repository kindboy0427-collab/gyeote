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
        { error: '부모님?� 최�? 2명까지�??�록?????�습?�다.' },
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

    const welcomeMessage = `${name}?? ?�녕?�세???��\n\n?��?분께??곁에 ?�비?��? ?�해\n매일 ?�침 ?��? ?�인???�작?�어??\n\n?�일 ?�침부??매일 ?��? 메시지�?보내?�릴게요.\n?�래 버튼???�러 채널??추�??�시�?n???�하�??�용?�실 ???�어??\n\n??�� 곁에 ?�을게요.\n- 곁에`

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
