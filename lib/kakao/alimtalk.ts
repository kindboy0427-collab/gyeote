import crypto from 'crypto'

type AlimtalkPayload = {
  to: string
  parentName: string
  message: string
  templateCode?: string
  linkUrl?: string
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

export async function generateTodayMessage(timeOfDay: 'morning' | 'lunch' | 'evening' = 'morning'): Promise<string> {
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

    const timeLabel = timeOfDay === 'morning' ? '아침' : timeOfDay === 'lunch' ? '점심' : '저녁'
    const tone = timeOfDay === 'morning'
      ? '하루를 시작하는 기분으로 응원하는 아침 인사 톤'
      : timeOfDay === 'lunch'
      ? '점심 식사 잘 챙겼는지 묻는 따뜻한 톤'
      : '하루를 마무리하며 수고했다는 저녁 톤'

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 200,
        messages: [
          {
            role: 'user',
            content: `오늘은 ${month} ${date}일 ${dayOfWeek}이고 ${season}입니다.
어르신께 보내는 카카오 알림톡 ${timeLabel} 메시지 한 개를 작성해주세요.
조건:
- 2~3문장으로 짧게
- ${tone}
- 오늘 날씨, 계절, 요일을 자연스럽게 연결
- 친근하고 따뜻하게
- 존댓말 사용
- 이모지 1개만 포함
- "카카오봇", "안녕하세요", "곁에 있을게요", "항상 응원" 같은 말은 포함하지 말 것
- 출력 형식 없이 문장만 출력`,
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
  return `${parentName}님, 좋은 아침이에요 🌅\n\n${todayMessage}\n\n카카오봇 안녕하세요 식사 잘 챙기시면 버튼을 눌러주세요\n\n항상 응원 곁에 있을게요.\n- 곁에`
}

export async function sendKakaoAlimtalk({
  to,
  parentName,
  message,
  templateCode,
  linkUrl,
}: AlimtalkPayload): Promise<AlimtalkResult> {
  try {
    const config = getAlimtalkConfig(templateCode)

    if (!config.ready) {
      return {
        success: false,
        status: 200,
        statusText: 'skipped',
        reason: 'ALIMTALK_NOT_CONFIGURED',
        error: `필수 환경변수 설정이 없습니다: ${config.missing.join(', ')}`,
        data: { missingEnv: config.missing },
      }
    }

    const variables: Record<string, string> = {
      '#{이름}': parentName,
      '#{오늘의한마디}': message,
    }

    if (linkUrl) {
      variables['#{링크}'] = linkUrl
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
          variables,
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