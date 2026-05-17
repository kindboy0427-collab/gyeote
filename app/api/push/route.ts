import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../src/lib/auth'
import { prisma } from '../../../src/lib/prisma'
import webpush from 'web-push'

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

// 구독 ?�??
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const kakaoId = (session?.user as any)?.id
  if (!kakaoId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { subscription } = await req.json()

  try {
    const user = await prisma.user.findFirst({
      where: { email: session?.user?.email ?? `kakao_${kakaoId}@gyeote.com` },
    })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // 구독 ?�보 ?�??(Subscription 모델 ?�용)
    await prisma.subscription.upsert({
      where: { userId: user.id },
      update: { billingKey: JSON.stringify(subscription) },
      create: {
        userId: user.id,
        billingKey: JSON.stringify(subscription),
        status: 'push_only',
        price: 0,
      },
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// ?�시 발송
export async function GET() {
  try {
    const subscriptions = await prisma.subscription.findMany({
      where: { status: 'push_only' },
      include: { user: { include: { parents: true } } },
    })

    for (const sub of subscriptions) {
      if (!sub.billingKey) continue
      const pushSubscription = JSON.parse(sub.billingKey)

      // 미응??부모님 ?�인
      const unresponded = sub.user.parents.filter(async (p) => {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const response = await prisma.response.findFirst({
          where: { parentId: p.id, date: { gte: today }, responded: false },
        })
        return response !== null
      })

      if (unresponded.length > 0) {
        await webpush.sendNotification(
          pushSubscription,
          JSON.stringify({
            title: '곁에 ?�림',
            body: `부모님???�직 ?�답?��? ?�으?�어?? ?�인?�보?�요.`,
          })
        )
      }
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
