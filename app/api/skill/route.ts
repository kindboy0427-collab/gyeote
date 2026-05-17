import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    
    const userRequest = body?.userRequest
    const utterance = userRequest?.utterance ?? ''
    const kakaoId = userRequest?.user?.id ?? ''

    // ?�용??찾기
    const user = await prisma.user.findFirst({
      where: { email: session?.user?.email ?? `kakao_${kakaoId}@gyeote.com` },
      include: { subscriptions: true },
    })

    if (!user) {
      return NextResponse.json({
        version: '2.0',
        template: {
          outputs: [{ simpleText: { text: '?�록???�용?��? 찾을 ???�어??' } }],
        },
      })
    }

    // ?�기 ?�??
    await prisma.review.create({
      data: {
        userId: user.id,
        content: utterance,
        rating: 5,
      },
    })

    // 구독 1주일 ?�장
    const subscription = user.subscriptions.find(
      (s) => s.status === 'trial' || s.status === 'active'
    )

    if (subscription) {
      const current = subscription.nextBillingAt ?? new Date()
      const newDate = new Date(current)
      newDate.setDate(newDate.getDate() + 7)

      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { nextBillingAt: newDate },
      })
    }

    return NextResponse.json({
      version: '2.0',
      template: {
        outputs: [
          {
            simpleText: {
              text: '?�중???�기 감사?�니???��\n7??무료 ?�장???�료?�어???��',
            },
          },
        ],
      },
    })
  } catch (e) {
    return NextResponse.json({
      version: '2.0',
      template: {
        outputs: [{ simpleText: { text: '?�류가 발생?�어?? ?�시 ?�도?�주?�요.' } }],
      },
    })
  }
}
