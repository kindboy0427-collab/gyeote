import NextAuth, { NextAuthOptions } from 'next-auth'
import KakaoProvider from 'next-auth/providers/kakao'

export const authOptions: NextAuthOptions = {
  providers: [
    KakaoProvider({
      clientId: process.env.KAKAO_CLIENT_ID!,
      clientSecret: process.env.KAKAO_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (token?.email) {
        session.user.email = token.email
      }
      if (token?.name) {
        session.user.name = token.name
      }
      if (token?.sub) {
        session.user.id = token.sub
      }
      return session
    },
    async jwt({ token, profile }) {
      if (profile) {
        token.email = (profile as any).kakao_account?.email ?? `kakao_${token.sub}@gyeote.com`
        token.name = (profile as any).properties?.nickname ?? '사용자'
      }
      return token
    },
  },
}

export default NextAuth(authOptions)