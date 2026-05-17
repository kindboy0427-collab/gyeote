import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendPushToUser } from '@/src/lib/push'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const KST_TIME_ZONE = 'Asia/Seoul'

function getBearerToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return null
  if (!authHeader.startsWith('Bearer ')) return null
  return authHeader.replace('Bearer ', '').trim()
}

function isCronAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return true
  return getBearerToken(request) === cronSecret
}

function getKstWeekRange() {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: KST_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = formatter.formatToParts(now)
  const values = Object.fromEntries(parts.filter(p => p.type !== 'literal').map(p => [p.type, p.value]))

  const today = new Date(`${values.year}-${values.month}-${values.day}T00:00:00.000+09:00`)
  const dayOfWeek = today.getDay()

  const monday = new Date(today)
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))

  const sunday = new Date(today)
  sunday.setHours(23, 59, 59, 999)

  const lastMonday = new Date(monday)
  lastMonday.setDate(monday.getDate() - 7)

  const lastSunday = new Date(monday)
  lastSunday.setDate(monday.getDate() - 1)
  lastSunday.setHours(23, 59, 59, 999)

  return { monday, sunday, lastMonday, lastSunday }
}

async function generateWeeklyReport(data: {
  parentName: string
  thisWeek: {
    morningTotal: number
    morningResponded: number
    lunchTotal: number
    lunchResponded: number
    eveningTotal: number
    eveningResponded: number
    helpCount: number
    fridayMessage: string | null
    avgResponseHour: number | null
    consecutiveDays: number
  }
  lastWeek: {
    morningTotal: number
    morningResponded: number
  }
}): Promise<string> {
  try {
    const { parentName, thisWeek, lastWeek } = data

    const thisWeekRate = thisWeek.morningTotal > 0
      ? Math.round((thisWeek.morningResponded / thisWeek.morningTotal) * 100)
      : 0
    const lastWeekRate = lastWeek.morningTotal > 0
      ? Math.round((lastWeek.morningResponded / lastWeek.morningTotal) * 100)
      : 0
    const rateDiff = thisWeekRate - lastWeekRate

    const prompt = `부모님(${parentName}?????�번 �??��? ?�이?��? 바탕?�로 ?��??�게 보내??주간 리포?��? ?�성?�주?�요.

?�이??
- ?�침 ?�답�? ${thisWeek.morningResponded}/${thisWeek.morningTotal}??(${thisWeekRate}%)
- ?�심 ?�답�? ${thisWeek.lunchResponded}/${thisWeek.lunchTotal}??
- ?�???�답�? ${thisWeek.eveningResponded}/${thisWeek.eveningTotal}??
- ?��? ?�청 ?�수: ${thisWeek.helpCount}??
- ?�속 ?�답?? ${thisWeek.consecutiveDays}??
- ?�균 ?�답 ?�간: ${thisWeek.avgResponseHour !== null ? `?�전/?�후 ${thisWeek.avgResponseHour}?? : '?�이???�음'}
- 지??�??��??�답�?변?? ${rateDiff > 0 ? `+${rateDiff}%` : `${rateDiff}%`}
${thisWeek.fridayMessage ? `- 부모님???�기??말�?: "${thisWeek.fridayMessage}"` : '- ?�번 �?금요??메시지 ?�음'}

조건:
- ?��?가 부모님??걱정?�는 마음?�로 ???��? ?�식
- ?�이?��? ?�어???�뜻?�고 감성?�으�?마무리할 �?
- "고객?�터", "?�락주세?? 같�? ?�비??멘트 ?��? ?��? �?�?
- "?�음 주�? 기�??�겠?�니?? 같�? ?�딱??마무�??��? �?�?
- 부모님??직접 부르는 ?�칭 ?��? �?�?(?�머?? ?�버지 X)
- 3~4문장?�로
- ?�뒤 ?�명 ?�이 리포???�용�?출력
- ?�모지 1~2�??�함`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const result = await response.json()
    return result.content?.[0]?.text?.trim() ?? '?�번 �?리포?��? ?�성?????�었?�요.'
  } catch {
    return '?�번 �?리포?��? ?�성?????�었?�요.'
  }
}

export async function GET(request: NextRequest) {
  try {
    if (!isCronAuthorized(request)) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 })
    }

    const { monday, sunday, lastMonday, lastSunday } = getKstWeekRange()

    const users = await prisma.user.findMany({
      where: {
        subscriptions: {
          some: { status: { in: ['active', 'trial'] } },
        },
        parents: { some: { isActive: true } },
      },
      include: {
        parents: {
          where: { isActive: true },
          include: {
            responses: {
              where: { date: { gte: monday, lte: sunday } },
            },
          },
        },
      },
    })

    const results = []

    for (const user of users) {
      for (const parent of user.parents) {
        const responses = parent.responses

        const morningResponses = responses.filter(r => r.type === 'morning')
        const lunchResponses = responses.filter(r => r.type === 'lunch')
        const eveningResponses = responses.filter(r => r.type === 'evening')
        const helpResponses = responses.filter(r => r.message?.includes('?��????�요?�요'))
        const fridayResponse = responses.find(r => r.type === 'evening' && r.responded && r.message)

        const respondedTimes = responses
          .filter(r => r.responded && r.respondedAt)
          .map(r => new Date(r.respondedAt!).getHours())
        const avgResponseHour = respondedTimes.length > 0
          ? Math.round(respondedTimes.reduce((a, b) => a + b, 0) / respondedTimes.length)
          : null

        let consecutiveDays = 0
        for (let i = 6; i >= 0; i--) {
          const date = new Date(sunday)
          date.setDate(sunday.getDate() - i)
          const dayStart = new Date(date)
          dayStart.setHours(0, 0, 0, 0)
          const dayEnd = new Date(date)
          dayEnd.setHours(23, 59, 59, 999)
          const dayResponded = responses.some(r => r.responded && new Date(r.date) >= dayStart && new Date(r.date) <= dayEnd)
          if (dayResponded) consecutiveDays++
          else consecutiveDays = 0
        }

        const lastWeekResponses = await prisma.response.findMany({
          where: { parentId: parent.id, date: { gte: lastMonday, lte: lastSunday }, type: 'morning' },
        })

        const reportText = await generateWeeklyReport({
          parentName: parent.name,
          thisWeek: {
            morningTotal: morningResponses.length,
            morningResponded: morningResponses.filter(r => r.responded).length,
            lunchTotal: lunchResponses.length,
            lunchResponded: lunchResponses.filter(r => r.responded).length,
            eveningTotal: eveningResponses.length,
            eveningResponded: eveningResponses.filter(r => r.responded).length,
            helpCount: helpResponses.length,
            fridayMessage: fridayResponse?.message ?? null,
            avgResponseHour,
            consecutiveDays,
          },
          lastWeek: {
            morningTotal: lastWeekResponses.length,
            morningResponded: lastWeekResponses.filter(r => r.responded).length,
          },
        })

        await prisma.report.create({
          data: {
            parentId: parent.id,
            type: 'weekly',
            content: reportText,
            weekStart: monday,
          },
        })

        await sendPushToUser(
          user.id,
          '?�� ?�번 �?리포?��? ?�착?�어??,
          `${parent.name}?�의 ?�번 �??��? 리포?��? ?�인?�보?�요.`
        )

        results.push({
          userId: user.id,
          parentId: parent.id,
          parentName: parent.name,
          reportText,
          status: 'generated',
        })
      }
    }

    return NextResponse.json({ ok: true, results })
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : '주간 리포???�성 ?�류' },
      { status: 500 }
    )
  }
}
