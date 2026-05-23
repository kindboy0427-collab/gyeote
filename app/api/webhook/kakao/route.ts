import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const KST_TIME_ZONE = 'Asia/Seoul'

function getKstParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: KST_TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  })
  const parts = formatter.formatToParts(date)
  const values = Object.fromEntries(
    parts.filter((p) => p.type !== 'literal').map((p) => [p.type, p.value])
  )
  return { year: values.year, month: values.month, day: values.day, hour: values.hour }
}

function getTodayKstRange() {
  const parts = getKstParts()
  return {
    start: new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00.000+09:00`),
    end: new Date(`${parts.year}-${parts.month}-${parts.day}T23:59:59.999+09:00`),
  }
}

function inferResponseType(kstHour: number): 'morning' | 'lunch' | 'evening' {
  if (kstHour >= 9 && kstHour < 12) return 'morning'
  if (kstHour >= 12 && kstHour < 15) return 'lunch'
  return 'evening'
}

export async function GET(request: NextRequest) {
  const challenge = request.nextUrl.searchParams.get('challenge')
  if (challenge) return NextResponse.json({ challenge })
  return NextResponse.json({ ok: true, message: 'Kakao webhook is alive.' })
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.WEBHOOK_SECRET
  if (webhookSecret) {
    const token = request.nextUrl.searchParams.get('secret')
    if (!token || token !== webhookSecret) {
      console.warn('[KAKAO_WEBHOOK] 인증 실패')
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 })
    }
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, message: 'Invalid JSON' }, { status: 400 })
  }

  const userRequest = body.userRequest as Record<string, unknown> | undefined
  const user = userRequest?.user as Record<string, unknown> | undefined
  const properties = user?.properties as Record<string, unknown> | undefined
  const kakaoId = (properties?.plusfriend_user_key ?? properties?.plusfriendUserKey) as string | null

  if (!kakaoId) {
    console.warn('[KAKAO_WEBHOOK] kakaoId 없음')
    return NextResponse.json({ ok: true, message: 'No kakaoId - ignored' })
  }

  const utterance = (userRequest?.utterance as string) ?? ''

  // kakaoId로 부모님 조회
  let parent = await prisma.parent.findFirst({
    where: { kakaoId },
    select: { id: true, name: true, phone: true, userId: true },
  })

  // 못 찾으면 kakaoId 없는 가장 최근 부모님에 자동 저장 (채널 추가 시)
  if (!parent) {
  // 전화번호로 매칭 시도
  const normalizedPhone = utterance.replace(/[^0-9]/g, '')
  if (normalizedPhone.length >= 10) {
    const parentByPhone = await prisma.parent.findFirst({
      where: { phone: normalizedPhone },
      select: { id: true, name: true, phone: true, userId: true },
    })
    if (parentByPhone) {
      await prisma.parent.update({
        where: { id: parentByPhone.id },
        data: { kakaoId },
      })
      console.log(`[KAKAO_WEBHOOK] kakaoId 저장: ${parentByPhone.name}(${normalizedPhone}) → ${kakaoId}`)
      return NextResponse.json({ ok: true, message: 'kakaoId saved' })
    }
  }
  console.log(`[KAKAO_WEBHOOK] 매칭 부모 없음 - kakaoId: ${kakaoId}`)
  return NextResponse.json({ ok: true, message: 'No matched parent - ignored' })
}

  const now = new Date()
  const kstHour = Number(getKstParts(now).hour)
  const responseType = inferResponseType(kstHour)
  const { start, end } = getTodayKstRange()

  const existing = await prisma.response.findFirst({
    where: {
      parentId: parent.id,
      type: responseType,
      date: { gte: start, lte: end },
    },
    orderBy: { date: 'desc' },
  })

  const response = existing
    ? await prisma.response.update({
        where: { id: existing.id },
        data: { responded: true, respondedAt: now, message: utterance },
      })
    : await prisma.response.create({
        data: {
          parentId: parent.id,
          type: responseType,
          responded: true,
          respondedAt: now,
          message: utterance,
          date: now,
        },
      })

  await prisma.notificationLog.create({
    data: {
      userId: parent.userId,
      parentId: parent.id,
      channel: 'KAKAO_ALIMTALK',
      status: 'sent',
      message: utterance,
      rawData: {
        kind: 'inbound_reply',
        responseId: response.id,
        responseType,
        kakaoId,
        receivedAt: now.toISOString(),
      },
    },
  })

  console.log(`[KAKAO_WEBHOOK] ${parent.name}(${kakaoId}) 답장 [${responseType}]: "${utterance}"`)

  return NextResponse.json({
    ok: true,
    parent: { id: parent.id, name: parent.name },
    responseType,
    responseId: response.id,
  })
}