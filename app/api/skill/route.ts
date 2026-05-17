import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    
    const userRequest = body?.userRequest
    const utterance = userRequest?.utterance ?? ''
    const kakaoId = userRequest?.user?.id ?? ''

    // 사용자 찾기
    const user = await prisma.user.findFirst({
      where: { email: `kakao_${kakaoId}@gyeote.com` },
      include: { subscriptions: true },
    })

    if (!user) {
      return NextResponse.json({
        version: '2.0',
        template: {
          outputs: [{ simpleText: { text: '등록된 사용자를 찾을 수 없어요.' } }],
        },
      })
    }

    // 후기 저장
    await prisma.review.create({
      data: {
        userId: user.id,
        content: utterance,
        rating: 5,
      },
    })

    // 구독 1주일 연장
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
              text: '소중한 후기 감사합니다 😊\n7일 무료 연장이 완료됐어요 🎁',
            },
          },
        ],
      },
    })
  } catch (e) {
    return NextResponse.json({
      version: '2.0',
      template: {
        outputs: [{ simpleText: { text: '오류가 발생했어요. 다시 시도해주세요.' } }],
      },
    })
  }
}