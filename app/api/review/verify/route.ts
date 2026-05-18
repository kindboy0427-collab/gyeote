import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'no token' }, { status: 400 })

  const user = await prisma.user.findFirst({
    where: { reviewToken: token },
    select: { name: true },
  })

  if (!user) return NextResponse.json({ error: 'invalid' }, { status: 404 })

  return NextResponse.json({ name: user.name ?? '회원' })
}