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