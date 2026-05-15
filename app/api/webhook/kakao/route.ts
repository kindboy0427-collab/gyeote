import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const KST_TIME_ZONE = 'Asia/Seoul'

// ─────────────────────────────────────────
// 타입
// ─────────────────────────────────────────

type SolapiInboundBody =
  | {
      data: {
        type?: string
        messageId?: string
        from?: string
        content?: { text?: string }
      }
    }
  | {
      type?: string
      messageId?: string
      from?: string
      text?: string
    }

// ─────────────────────────────────────────
// 유틸
// ─────────────────────────────────────────

function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9]/g, '')
}

function getKstParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: KST_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })

  const parts = formatter.formatToParts(date)
  const values = Object.fromEntries(
    parts.filter((p) => p.type !== 'literal').map((p) => [p.type, p.value])
  )

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  }
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

function parsePayload(body: SolapiInboundBody): {
  fromPhone: string | null
  text: string
  messageId: string
} {
  if ('data' in body && body.data) {
    return {
      fromPhone: body.data.from ?? null,
      text: body.data.content?.text ?? '',
      messageId: body.data.messageId ?? '',
    }
  }
  if ('from' in body) {
    return {
      fromPhone: body.from ?? null,
      text: (body as { text?: string }).text ?? '',
      messageId: (body as { messageId?: string }).messageId ?? '',
    }
  }
  return { fromPhone: null, text: '', messageId: '' }
}

// ─────────────────────────────────────────
// GET: 솔라피 웹훅 등록 시 연결 확인용
// ─────────────────────────────────────────

export async function GET(request: NextRequest) {
  const challenge = request.nextUrl.searchParams.get('challenge')
  if (challenge) {
    return NextResponse.json({ challenge })
  }
  return NextResponse.json({ ok: true, message: 'Kakao webhook is alive.' })
}

// ─────────────────────────────────────────
// POST: 솔라피 → 부모님 답장 수신
// ─────────────────────────────────────────

export async function POST(request: NextRequest) {
  // 1. 쿼리 파라미터로 시크릿 검증
  const webhookSecret = process.env.WEBHOOK_SECRET
  if (webhookSecret) {
    const token = request.nextUrl.searchParams.get('secret')
    if (!token || token !== webhookSecret) {
      console.warn('[KAKAO_WEBHOOK] 인증 실패 - 잘못된 secret')
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 })
    }
  }

  // 2. JSON 파싱
  let body: SolapiInboundBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, message: 'Invalid JSON' }, { status: 400 })
  }

  const { fromPhone, text, messageId } = parsePayload(body)

  if (!fromPhone) {
    console.warn('[KAKAO_WEBHOOK] 발신자 번호 없음')
    return NextResponse.json({ ok: true, message: 'No sender phone — ignored' })
  }

  const normalizedPhone = normalizePhone(fromPhone)

  // 3. 전화번호로 부모님 조회
  const parent = await prisma.parent.findFirst({
    where: { phone: normalizedPhone },
    select: { id: true, name: true, phone: true, userId: true },
  })

  if (!parent) {
    console.log(`[KAKAO_WEBHOOK] 매칭되는 부모님 없음: ${normalizedPhone}`)
    return NextResponse.json({ ok: true, message: 'No matched parent — ignored' })
  }

  const now = new Date()
  const kstHour = Number(getKstParts(now).hour)
  const responseType = inferResponseType(kstHour)
  const { start, end } = getTodayKstRange()

  // 4. 오늘 Response 조회 → upsert
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
        data: {
          responded: true,
          respondedAt: now,
          message: text,
        },
      })
    : await prisma.response.create({
        data: {
          parentId: parent.id,
          type: responseType,
          responded: true,
          respondedAt: now,
          message: text,
          date: now,
        },
      })

  // 5. 수신 로그 기록 (reply-check 크론 판단용)
  await prisma.notificationLog.create({
    data: {
      userId: parent.userId,
      parentId: parent.id,
      channel: 'KAKAO_ALIMTALK',
      status: 'sent',
      message: text,
      rawData: {
        kind: 'inbound_reply',
        responseId: response.id,
        responseType,
        messageId,
        fromPhone: normalizedPhone,
        receivedAt: now.toISOString(),
      },
    },
  })

  console.log(
    `[KAKAO_WEBHOOK] ✅ ${parent.name}(${normalizedPhone}) 답장 수신 [${responseType}]: "${text}"`
  )

  return NextResponse.json({
    ok: true,
    parent: { id: parent.id, name: parent.name },
    responseType,
    responseId: response.id,
  })
}