import { NextAuthOptions } from 'next-auth'
import KakaoProvider from 'next-auth/providers/kakao'
import { prisma } from './prisma'

export const authOptions: NextAuthOptions = {
  cookies: {
    pkceCodeVerifier: {
      name: 'next-auth.pkce.code_verifier',
      options: {
        httpOnly: true,
        sameSite: 'none',
        path: '/',
        secure: true,
      },
    },
    state: {
      name: 'next-auth.state',
      options: {
        httpOnly: true,
        sameSite: 'none',
        path: '/',
        secure: true,
      },
    },
  },
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
        if (!kakaoId) return false

        // 이메일 동의 여부 상관없이 카카오 ID로만 처리
        const email = `kakao_${kakaoId}@gyeote.com`
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
        // 이메일 동의 여부 상관없이 카카오 ID 기반 이메일 사용
        token.email = `kakao_${token.sub}@gyeote.com`
        token.name = profile.kakao_account?.profile?.nickname ?? profile.properties?.nickname ?? 'user'
      }
      return token
    },
  },
}