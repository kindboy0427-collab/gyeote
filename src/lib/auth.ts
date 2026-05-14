import { NextAuthOptions } from 'next-auth'
import KakaoProvider from 'next-auth/providers/kakao'
import { prisma } from './prisma'

export const authOptions: NextAuthOptions = {
  providers: [
    KakaoProvider({
      clientId: process.env.KAKAO_CLIENT_ID!,
      clientSecret: process.env.KAKAO_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ profile }: any) {
      try {
        const kakaoId = profile?.id?.toString()
        const email = profile?.kakao_account?.email ?? `kakao_${kakaoId}@gyeote.com`
        const name = profile?.kakao_account?.profile?.nickname ?? profile?.properties?.nickname ?? '사용자'

        let user = await prisma.user.findFirst({
          where: { email },
          include: { subscriptions: true },
        })

        if (!user) {
          user = await prisma.user.create({
            data: { email, name },
            include: { subscriptions: true },
          })
        }

        // trial 구독이 없으면 자동 생성
        const hasSub = user.subscriptions.length > 0
        if (!hasSub) {
          const trialEnd = new Date()
          trialEnd.setDate(trialEnd.getDate() + 30)

          await prisma.subscription.create({
            data: {
              userId: user.id,
              plan: 'monthly',
              provider: 'TRIAL',
              status: 'trial',
              price: 0,
              nextBillingAt: trialEnd,
            },
          })
        }

        return true
      } catch (e) {
        console.error('signIn error:', e)
        return true
      }
    },

    async session({ session, token }: any) {
      if (session.user) {
        if (token?.email) session.user.email = token.email
        if (token?.name) session.user.name = token.name
        if (token?.sub) session.user.id = token.sub
      }
      return session
    },

    async jwt({ token, profile }: any) {
      if (profile) {
        token.email = profile.kakao_account?.email ?? `kakao_${token.sub}@gyeote.com`
        token.name = profile.kakao_account?.profile?.nickname ?? profile.properties?.nickname ?? 'user'
      }
      return token
    },
  },
}