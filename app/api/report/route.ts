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

    // 대화 히스토리 가져오기
    const messages = await prisma.message.findMany({
      where: { parentId, createdAt: { gte: from } },
      orderBy: { createdAt: 'asc' },
    })

    // 응답 기록 가져오기
    const responses = await prisma.response.findMany({
      where: { parentId, date: { gte: from } },
    })

    const respondedCount = responses.filter(r => r.responded).length
    const totalCount = responses.length

    const conversationSummary = messages
      .map(m => `${m.role === 'user' ? '부모님' : 'AI'}: ${m.content}`)
      .join('\n')

    // Claude API로 리포트 생성
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: '당신은 고령자 케어 전문가예요. 대화 내용을 분석해서 자녀에게 부모님 상태 리포트를 작성해주세요. 따뜻하고 명확하게 작성하세요.',
      messages: [{
        role: 'user',
        content: `${parent?.name}님의 ${type === 'monthly' ? '월간' : '주간'} 리포트를 작성해주세요.

응답률: ${totalCount > 0 ? Math.round((respondedCount / totalCount) * 100) : 0}% (${respondedCount}/${totalCount})

대화 내용:
${conversationSummary || '대화 기록 없음'}

다음 항목을 포함해주세요:
1. 전반적인 상태 요약
2. 건강 관련 언급 사항
3. 응답 패턴 분석
4. 자녀에게 전하는 한마디`,
      }],
    })

    const content = response.content[0].type === 'text' ? response.content[0].text : ''

    // 리포트 저장
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