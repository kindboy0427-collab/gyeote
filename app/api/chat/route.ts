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
    // 대화 히스토리 가져오기 (최근 20개)
    const history = await prisma.message.findMany({
      where: { parentId },
      orderBy: { createdAt: 'asc' },
      take: 20,
    })

    // 부모님 정보 가져오기
    const parent = await prisma.parent.findUnique({ where: { id: parentId } })

    // 사용자 메시지 저장
    await prisma.message.create({
      data: { parentId, role: 'user', content: message },
    })

    // Claude API 호출
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: `당신은 ${parent?.name}님의 매일 아침 친구예요. 따뜻하고 친근하게 대화하세요. 
건강 상태, 식사, 수면을 자연스럽게 확인하고 걱정되는 부분은 기록해두세요.
짧고 자연스럽게 답변하세요. 카카오톡 말투로요.`,
      messages: [
        ...history.map(h => ({
          role: h.role as 'user' | 'assistant',
          content: h.content,
        })),
        { role: 'user', content: message },
      ],
    })

    const reply = response.content[0].type === 'text' ? response.content[0].text : ''

    // AI 답변 저장
    await prisma.message.create({
      data: { parentId, role: 'assistant', content: reply },
    })

    return NextResponse.json({ reply })
  } catch (e) {
    console.error('Chat error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}