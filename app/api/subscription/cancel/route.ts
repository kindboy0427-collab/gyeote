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
          { email: session?.user?.email ?? `kakao_${kakaoId}@gyeote.com` },
          { email: sessionEmail },
        ],
      },
      include: {
        subscriptions: true,
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: '?�용?��? 찾을 ???�습?�다.' },
        { status: 404 }
      )
    }

    const subscription = user.subscriptions[0]

    if (!subscription) {
      return NextResponse.json(
        { error: '구독 ?�보가 ?�습?�다.' },
        { status: 404 }
      )
    }

    if (subscription.status === 'canceled') {
      return NextResponse.json({
        success: true,
        message: '?��? ?��???구독?�니??',
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
      message: '구독???��??�었?�니?? ?�음 결제?��????�동 결제가 중단?�니??',
      subscription: canceledSubscription,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : '구독 ?��? �??�류가 발생?�습?�다.',
      },
      { status: 500 }
    )
  }
}
