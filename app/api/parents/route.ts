import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../src/lib/auth'
import { prisma } from '../../../src/lib/prisma'
import { sendKakaoAlimtalk } from '../../../lib/kakao/alimtalk'

function normalizePhone(phone: string) {
  return phone.replace(/[^0-9]/g, '')
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const kakaoId = (session?.user as any)?.id

  if (!kakaoId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const {
    name,
    phone,
    guardianPhone,
    morningTime,
    mealCheck,
    medication,
  } = await req.json()

  if (!name || !phone || !guardianPhone) {
    return NextResponse.json(
      {
        error: '부모님 성함, 부모님 전화번호, 보호자 전화번호는 필수입니다.',
      },
      { status: 400 }
    )
  }

  const normalizedParentPhone = normalizePhone(phone)
  const normalizedGuardianPhone = normalizePhone(guardianPhone)
  const normalizedMedication =
    typeof medication === 'string' && medication.trim().length > 0
      ? medication.trim()
      : null

  try {
    const user = await prisma.user.upsert({
      where: {
        email: session?.user?.email ?? `kakao_${kakaoId}@gyeote.com`,
      },
      update: {
        guardianPhone: normalizedGuardianPhone,
      },
      create: {
        email: session?.user?.email ?? `kakao_${kakaoId}@gyeote.com`,
        name: session?.user?.name ?? 'user',
        guardianPhone: normalizedGuardianPhone,
      },
    })

    const parentCount = await prisma.parent.count({
      where: { userId: user.id },
    })

    if (parentCount >= 2) {
      return NextResponse.json(
        { error: '부모님은 최대 2명까지 등록할 수 있습니다.' },
        { status: 400 }
      )
    }

    const parent = await prisma.parent.create({
      data: {
        userId: user.id,
        name,
        phone: normalizedParentPhone,
        morningTime: morningTime ?? '09:00',
        mealCheck: mealCheck !== false,
        medication: normalizedMedication,
        isActive: true,
      },
    })

    const welcomeMessage = `${name}님 안녕하세요.

자녀분께서 곁에 서비스를 통해
매일 안부 확인을 시작했어요.

내일 아침부터 매일 안부 메시지를 보내드릴게요.
아래 버튼을 눌러 채널을 추가하시면
안정적으로 이용하실 수 있어요.

항상 곁에 있을게요.
- 곁에`

    await sendKakaoAlimtalk({
      to: normalizedParentPhone,
      parentName: name,
      message: welcomeMessage,
      templateCode: process.env.KAKAO_ALIMTALK_TEMPLATE_CODE_WELCOME,
    }).catch((error) => {
      console.error('welcome alimtalk error:', error)
    })

    return NextResponse.json({ success: true, parent })
  } catch (error) {
    console.error('parents create error:', error)

    return NextResponse.json(
      {
        error: 'Failed',
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
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
      where: {
        email: session?.user?.email ?? `kakao_${kakaoId}@gyeote.com`,
      },
      include: {
        parents: true,
      },
    })

    return NextResponse.json({
      parents: user?.parents ?? [],
      guardianPhone: user?.guardianPhone ?? '',
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed',
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}