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

  const { parentId, type } = await req.json() // type: 'weekly' | 'monthly'

  try {
    const parent = await prisma.parent.findUnique({ where: { id: parentId } })

    // 기간 계산
    const now = new Date()
    const daysBack = type === 'monthly' ? 30 : 7
    const from = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000)

    // ?�???�스?�리 가?�오�?
    const messages = await prisma.message.findMany({
      where: { parentId, createdAt: { gte: from } },
      orderBy: { createdAt: 'asc' },
    })

    // ?�답 기록 가?�오�?
    const responses = await prisma.response.findMany({
      where: { parentId, date: { gte: from } },
    })

    const respondedCount = responses.filter(r => r.responded).length
    const totalCount = responses.length

    const conversationSummary = messages
      .map(m => `${m.role === 'user' ? '부모님' : 'AI'}: ${m.content}`)
      .join('\n')

    // Claude API�?리포???�성
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: '?�신?� 고령??케???�문가?�요. ?�???�용??분석?�서 ?��??�게 부모님 ?�태 리포?��? ?�성?�주?�요. ?�뜻?�고 명확?�게 ?�성?�세??',
      messages: [{
        role: 'user',
        content: `${parent?.name}?�의 ${type === 'monthly' ? '?�간' : '주간'} 리포?��? ?�성?�주?�요.

?�답�? ${totalCount > 0 ? Math.round((respondedCount / totalCount) * 100) : 0}% (${respondedCount}/${totalCount})

?�???�용:
${conversationSummary || '?�??기록 ?�음'}

?�음 ??��???�함?�주?�요:
1. ?�반?�인 ?�태 ?�약
2. 건강 관???�급 ?�항
3. ?�답 ?�턴 분석
4. ?��??�게 ?�하???�마??,
      }],
    })

    const content = response.content[0].type === 'text' ? response.content[0].text : ''

    // 리포???�??
    const report = await prisma.report.create({
      data: {
        parentId,
        type,
        weekStart: from,
        content,
      },
    })

    return NextResponse.json({ success: true, report })
  } catch (e) {
    console.error('Report error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
