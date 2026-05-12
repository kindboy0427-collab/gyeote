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
  apiUrl: string
  apiKey: string
  senderKey: string
  templateCode: string
}

type AlimtalkMissingConfig = {
  ready: false
  missing: string[]
  apiUrl: null
  apiKey: null
  senderKey: null
  templateCode: null
}

type AlimtalkConfig = AlimtalkReadyConfig | AlimtalkMissingConfig

function normalizePhoneNumber(phone: string) {
  return phone.replace(/[^0-9]/g, '')
}

function getOptionalEnv(name: string) {
  const value = process.env[name]

  if (!value || value.trim() === '') {
    return null
  }

  return value
}

function getAlimtalkConfig(templateCode?: string): AlimtalkConfig {
  const apiUrl = getOptionalEnv('KAKAO_ALIMTALK_API_URL')
  const apiKey = getOptionalEnv('KAKAO_ALIMTALK_API_KEY')
  const senderKey = getOptionalEnv('KAKAO_ALIMTALK_SENDER_KEY')
  const finalTemplateCode =
    templateCode || getOptionalEnv('KAKAO_ALIMTALK_TEMPLATE_CODE')

  const missing: string[] = []

  if (!apiUrl) {
    missing.push('KAKAO_ALIMTALK_API_URL')
  }

  if (!apiKey) {
    missing.push('KAKAO_ALIMTALK_API_KEY')
  }

  if (!senderKey) {
    missing.push('KAKAO_ALIMTALK_SENDER_KEY')
  }

  if (!finalTemplateCode) {
    missing.push('KAKAO_ALIMTALK_TEMPLATE_CODE')
  }

  if (missing.length > 0) {
    return {
      ready: false,
      missing,
      apiUrl: null,
      apiKey: null,
      senderKey: null,
      templateCode: null,
    }
  }

  return {
    ready: true,
    missing: [],
    apiUrl: apiUrl as string,
    apiKey: apiKey as string,
    senderKey: senderKey as string,
    templateCode: finalTemplateCode as string,
  }
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
        data: {
          missingEnv: config.missing,
        },
      }
    }

    const payload = {
      senderKey: config.senderKey,
      templateCode: config.templateCode,
      recipient: normalizePhoneNumber(to),
      variables: {
        parentName,
        message,
      },
      message,
    }

    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
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
        error:
          typeof data === 'object' && data !== null && 'message' in data
            ? String((data as { message: unknown }).message)
            : '카카오 알림톡 발송에 실패했습니다.',
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
      error:
        error instanceof Error
          ? error.message
          : '카카오 알림톡 발송 중 알 수 없는 오류가 발생했습니다.',
    }
  }
}

export function createMorningAlimtalkMessage(parentName: string) {
  return `${parentName}님, 좋은 아침입니다. 오늘 컨디션은 어떠신가요? 편하게 답장해 주세요.`
}