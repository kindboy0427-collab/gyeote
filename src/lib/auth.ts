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

        const user = await prisma.user.findFirst({ where: { email } })

        if (!user) {
          await prisma.user.create({ data: { email, name } })
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