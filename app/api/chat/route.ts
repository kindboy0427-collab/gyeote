import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../src/lib/auth'
import { prisma } from '../../../src/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const kakaoId = (session?.user as any)?.id
  if (!kakaoId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { parentId, message } = await req.json()

  try {
    // ?�???�스?�리 가?�오�?(최근 20�?
    const history = await prisma.message.findMany({
      where: { parentId },
      orderBy: { createdAt: 'asc' },
      take: 20,
    })

    // 부모님 ?�보 가?�오�?
    const parent = await prisma.parent.findUnique({ where: { id: parentId } })

    // ?�용??메시지 ?�??
    await prisma.message.create({
      data: { parentId, role: 'user', content: message },
    })

    // Claude API ?�출
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: `?�신?� ${parent?.name}?�의 매일 ?�침 친구?�요. ?�뜻?�고 친근?�게 ?�?�하?�요. 
건강 ?�태, ?�사, ?�면???�연?�럽�??�인?�고 걱정?�는 부분�? 기록?�두?�요.
짧고 ?�연?�럽�??��??�세?? 카카?�톡 말투로요.`,
      messages: [
        ...history.map(h => ({
          role: h.role as 'user' | 'assistant',
          content: h.content,
        })),
        { role: 'user', content: message },
      ],
    })

    const reply = response.content[0].type === 'text' ? response.content[0].text : ''

    // AI ?��? ?�??
    await prisma.message.create({
      data: { parentId, role: 'assistant', content: reply },
    })

    return NextResponse.json({ reply })
  } catch (e) {
    console.error('Chat error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
