import crypto from 'crypto'

type AlimtalkPayload = {
  to: string
  parentName: string
  message: string
  templateCode?: string
}

type AlimtalkResult = {
  success: boolean
  status: number
  statusText: 'sent' | 'failed' | 'skipped'
  data?: unknown
  error?: string
  reason?: string
}

type AlimtalkReadyConfig = {
  ready: true
  missing: string[]
  apiKey: string
  apiSecret: string
  senderKey: string
  templateCode: string
}

type AlimtalkMissingConfig = {
  ready: false
  missing: string[]
  apiKey: null
  apiSecret: null
  senderKey: null
  templateCode: null
}

type AlimtalkConfig = AlimtalkReadyConfig | AlimtalkMissingConfig

function normalizePhoneNumber(phone: string) {
  return phone.replace(/[^0-9]/g, '')
}

function getOptionalEnv(name: string) {
  const value = process.env[name]
  if (!value || value.trim() === '') return null
  return value
}

function getSolapiAuthHeader(apiKey: string, apiSecret: string) {
  const date = new Date().toISOString()
  const salt = crypto.randomBytes(16).toString('hex')
  const hmac = crypto.createHmac('sha256', apiSecret)
  hmac.update(date + salt)
  const signature = hmac.digest('hex')
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`
}

function getAlimtalkConfig(templateCode?: string): AlimtalkConfig {
  const apiKey = getOptionalEnv('KAKAO_ALIMTALK_API_KEY')
  const apiSecret = getOptionalEnv('KAKAO_ALIMTALK_API_SECRET')
  const senderKey = getOptionalEnv('KAKAO_ALIMTALK_SENDER_KEY')
  const finalTemplateCode = templateCode || getOptionalEnv('KAKAO_ALIMTALK_TEMPLATE_CODE')

  const missing: string[] = []
  if (!apiKey) missing.push('KAKAO_ALIMTALK_API_KEY')
  if (!apiSecret) missing.push('KAKAO_ALIMTALK_API_SECRET')
  if (!senderKey) missing.push('KAKAO_ALIMTALK_SENDER_KEY')
  if (!finalTemplateCode) missing.push('KAKAO_ALIMTALK_TEMPLATE_CODE')

  if (missing.length > 0) {
    return { ready: false, missing, apiKey: null, apiSecret: null, senderKey: null, templateCode: null }
  }

  return {
    ready: true,
    missing: [],
    apiKey: apiKey as string,
    apiSecret: apiSecret as string,
    senderKey: senderKey as string,
    templateCode: finalTemplateCode as string,
  }
}

export async function generateTodayMessage(): Promise<string> {
  try {
    const today = new Date()
    const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']
    const months = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']
    const dayOfWeek = days[today.getDay()]
    const month = months[today.getMonth()]
    const date = today.getDate()
    const season =
      today.getMonth() >= 2 && today.getMonth() <= 4 ? '봄' :
      today.getMonth() >= 5 && today.getMonth() <= 7 ? '여름' :
      today.getMonth() >= 8 && today.getMonth() <= 10 ? '가을' : '겨울'

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [
          {
            role: 'user',
            content: `오늘은 ${month} ${date}일 ${dayOfWeek}이고 ${season}이에요.
자녀를 대신해서 부모님께 보내는 따뜻한 안부 한마디를 써주세요.
조건:
- 2~3문장으로 짧게
- 오늘 날씨, 요일, 계절을 자연스럽게 녹여서
- 진심이 느껴지고 감성적으로
- 존댓말 사용
- 이모지 1개 포함
- 앞뒤 설명 없이 문구만 출력`,
          },
        ],
      }),
    })

    const data = await response.json()
    return data.content?.[0]?.text?.trim() ?? '오늘 하루도 건강하게 보내세요 😊'
  } catch {
    return '오늘 하루도 건강하게 보내세요 😊'
  }
}

export function createMorningAlimtalkMessage(parentName: string, todayMessage: string) {
  return `${parentName}님, 좋은 아침이에요 🌞\n\n${todayMessage}\n\n아프거나 불편하신 게 있으시면 언제든지 편하게 말씀해 주세요.\n\n항상 당신 곁에 있을게요.\n- 곁에`
}

export async function sendKakaoAlimtalk({
  to,
  parentName,
  message,
  templateCode,
}: AlimtalkPayload): Promise<AlimtalkResult> {
  try {
    const config = getAlimtalkConfig(templateCode)

    if (!config.ready) {
      return {
        success: false,
        status: 200,
        statusText: 'skipped',
        reason: 'ALIMTALK_NOT_CONFIGURED',
        error: `카카오 알림톡 설정값이 없습니다: ${config.missing.join(', ')}`,
        data: { missingEnv: config.missing },
      }
    }

    const payload = {
  message: {
    to: normalizePhoneNumber(to),
    from: '01045788368',
    type: 'ATA',
    kakaoOptions: {
      pfId: config.senderKey,
      templateId: config.templateCode,
      disableSms: true,
      variables: {
        '#{이름}': parentName,
        '#{오늘의한마디}': message,
      },
    },
  },
}

    const authHeader = getSolapiAuthHeader(config.apiKey, config.apiSecret)

    const response = await fetch('https://api.solapi.com/messages/v4/send', {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json().catch(() => null)

    if (!response.ok) {
      return {
        success: false,
        status: response.status,
        statusText: 'failed',
        data,
        error: JSON.stringify(data),
      }
    }

    return {
      success: true,
      status: response.status,
      statusText: 'sent',
      data,
    }
  } catch (error) {
    return {
      success: false,
      status: 500,
      statusText: 'failed',
      error: error instanceof Error ? error.message : '알 수 없는 오류',
    }
  }
}