'use client'

import { useState } from 'react'

type PlanId = 'monthly' | 'yearly'
type ProviderId = 'KAKAO_PAY' | 'TOSS'

type PaymentPlan = {
  id: PlanId
  name: string
  description: string
  price: number
  cycleText: string
  badge?: string
}

type PaymentProvider = {
  id: ProviderId
  name: string
  description: string
}

const plans: PaymentPlan[] = [
  {
    id: 'monthly',
    name: '월간 구독',
    description: '매월 자동 결제 · 언제든 해지 가능',
    price: 4900,
    cycleText: '매월',
  },
  {
    id: 'yearly',
    name: '연간 구독',
    description: '매년 자동 결제 · 언제든 해지 가능',
    price: 50000,
    cycleText: '매년',
    badge: '추천',
  },
]

const providers: PaymentProvider[] = [
  {
    id: 'KAKAO_PAY',
    name: '카카오페이',
    description: '카카오톡에 등록된 결제수단으로 구독',
  },
  {
    id: 'TOSS',
    name: '카드/계좌',
    description: '토스페이먼츠 자동결제 등록',
  },
]

function formatPrice(price: number) {
  return price.toLocaleString('ko-KR')
}

function createCustomerKey() {
  return `gyeote_customer_${crypto.randomUUID().replaceAll('-', '')}`
}

export default function PaymentPage() {
  const [selectedPlanId, setSelectedPlanId] = useState<PlanId>('monthly')
  const [selectedProviderId, setSelectedProviderId] =
    useState<ProviderId>('KAKAO_PAY')
  const [loading, setLoading] = useState(false)

  const selectedPlan =
    plans.find((plan) => plan.id === selectedPlanId) ?? plans[0]

  const selectedProvider =
    providers.find((provider) => provider.id === selectedProviderId) ??
    providers[0]

  const handleSubscribe = async () => {
    if (loading) return

    setLoading(true)

    try {
      if (selectedProvider.id === 'KAKAO_PAY') {
        const response = await fetch('/api/payments/kakaopay/ready', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            plan: selectedPlan.id,
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data?.error || '카카오페이 결제 준비에 실패했습니다.')
        }

        const redirectUrl =
          data.next_redirect_pc_url ||
          data.next_redirect_mobile_url ||
          data.next_redirect_app_url

        if (!redirectUrl) {
          throw new Error('카카오페이 결제 URL을 받지 못했습니다.')
        }

        window.location.href = redirectUrl
        return
      }

      if (selectedProvider.id === 'TOSS') {
        const { loadTossPayments } = await import('@tosspayments/payment-sdk')
        const tossPayments = await loadTossPayments(
          process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY!
        )

        const customerKey = createCustomerKey()

        await tossPayments.requestBillingAuth('카드', {
          customerKey,
          successUrl: `${window.location.origin}/payment/success?provider=TOSS&plan=${selectedPlan.id}`,
          failUrl: `${window.location.origin}/payment/fail?provider=TOSS&plan=${selectedPlan.id}`,
        })

        return
      }
    } catch (error) {
      console.error('Subscribe error:', error)
      alert(
        error instanceof Error
          ? error.message
          : '구독 결제 준비 중 오류가 발생했습니다.'
      )
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-10">
      <div className="bg-white rounded-2xl shadow-sm p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold text-green-600 mb-2 text-center">
          곁에 구독
        </h1>

        <p className="text-gray-500 text-sm text-center mb-8">
          부모님 안부 확인을 위한 구독 상품을 선택하세요.
        </p>

        <section className="mb-6">
          <h2 className="text-sm font-bold text-gray-800 mb-3">
            1. 구독 상품 선택
          </h2>

          <div className="space-y-3">
            {plans.map((plan) => {
              const selected = selectedPlan.id === plan.id

              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedPlanId(plan.id)}
                  className={`w-full rounded-2xl border p-5 text-left transition ${
                    selected
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-gray-800">{plan.name}</p>
                        {plan.badge && (
                          <span className="rounded-full bg-yellow-400 px-2 py-0.5 text-xs font-bold text-gray-800">
                            {plan.badge}
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-gray-500 mt-1">
                        {plan.description}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-xl font-bold text-green-600">
                        {formatPrice(plan.price)}원
                      </p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        <section className="mb-6">
          <h2 className="text-sm font-bold text-gray-800 mb-3">
            2. 결제수단 선택
          </h2>

          <div className="grid grid-cols-1 gap-3">
            {providers.map((provider) => {
              const selected = selectedProvider.id === provider.id

              return (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => setSelectedProviderId(provider.id)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    selected
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <p className="font-bold text-gray-800">{provider.name}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {provider.description}
                  </p>
                </button>
              )
            })}
          </div>
        </section>

        <div className="bg-gray-50 rounded-xl p-5 mb-6">
          <p className="text-sm font-bold text-gray-800 mb-2">
            선택한 구독
          </p>

          <p className="text-sm text-gray-600">
            {selectedPlan.name} · {selectedPlan.cycleText}{' '}
            {formatPrice(selectedPlan.price)}원 자동 결제
          </p>

          <p className="text-sm text-gray-600 mt-1">
            결제수단: {selectedProvider.name}
          </p>
        </div>

        <button
          onClick={handleSubscribe}
          disabled={loading}
          className="w-full bg-green-500 text-white py-4 rounded-xl font-bold disabled:opacity-60"
        >
          {loading
            ? '구독 결제 준비 중...'
            : `${selectedPlan.name} 시작하기`}
        </button>

        <p className="text-xs text-gray-400 text-center mt-4">
          구독은 직접 해지하기 전까지 {selectedPlan.cycleText} 자동 결제됩니다.
        </p>
      </div>
    </main>
  )
}