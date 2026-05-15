import webpush from 'web-push'
import { prisma } from '@/lib/prisma'

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export async function sendPushToUser(userId: string, title: string, body: string) {
  try {
    const pushSub = await prisma.subscription.findFirst({
      where: { userId, status: 'push_only' },
    })

    if (!pushSub?.billingKey) return { success: false, reason: 'no_push_subscription' }

    const pushSubscription = JSON.parse(pushSub.billingKey)

    await webpush.sendNotification(
      pushSubscription,
      JSON.stringify({ title, body })
    )

    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}