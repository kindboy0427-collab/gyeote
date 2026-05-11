import { NextResponse } from 'next/server'
import { prisma } from '../../../../src/lib/prisma'

export async function GET(request: Request) {
  // 보안: Vercel Cron 요청만 허용
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // 활성화된 부모님 전체 가져오기
    const parents = await prisma.parent.findMany({
      where: { isActive: true },
      include: { user: true },
    })

    // 각 부모님에게 아침 메시지 발송 (나중에 카카오 알림톡으로 교체)
    const results = []
    for (const parent of parents) {
      // TODO: 카카오 알림톡 발송
      // 지금은 DB에 발송 기록만 저장
      const response = await prisma.response.create({
        data: {
          parentId: parent.id,
          responded: false,
          type: 'morning',
        },
      })
      results.push({ parentId: parent.id, responseId: response.id })
    }

    return NextResponse.json({ success: true, sent: results.length, results })
  } catch (e) {
    console.error('Cron error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}