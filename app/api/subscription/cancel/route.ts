import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../src/lib/auth'
import { prisma } from '../../../../src/lib/prisma'

export async function POST(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  const kakaoId = (session?.user as any)?.id
  const sessionEmail = session?.user?.email ?? ''

  if (!kakaoId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: `kakao_${kakaoId}@gyeote.com` },
          { email: sessionEmail },
        ],
      },
      include: {
        subscriptions: true,
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    const subscription = user.subscriptions[0]

    if (!subscription) {
      return NextResponse.json(
        { error: '구독 정보가 없습니다.' },
        { status: 404 }
      )
    }

    if (subscription.status === 'canceled') {
      return NextResponse.json({
        success: true,
        message: '이미 해지된 구독입니다.',
        subscription,
      })
    }

    const canceledSubscription = await prisma.subscription.update({
      where: {
        userId: user.id,
      },
      data: {
        status: 'canceled',
        canceledAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      message: '구독이 해지되었습니다. 다음 결제일부터 자동 결제가 중단됩니다.',
      subscription: canceledSubscription,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : '구독 해지 중 오류가 발생했습니다.',
      },
      { status: 500 }
    )
  }
}