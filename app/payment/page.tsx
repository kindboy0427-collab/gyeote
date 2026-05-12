'use client'

import { useState } from 'react'

export default function PaymentPage() {
  const [loading, setLoading] = useState(false)

  const handlePayment = async () => {
    setLoading(true)
    try {
      const { loadTossPayments } = await import('@tosspayments/payment-widget-sdk')
      const tossPayments = await loadTossPayments(process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY!)
      await tossPayments.requestBillingAuth('카드', {
        customerKey: crypto.randomUUID(),
        successUrl: `${window.location.origin}/payment/success`,
        failUrl: `${window.location.origin}/payment/fail`,
      })
    } catch (e) {
      console.error(e)
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm p-8 max-w-sm w-full">
        <h1 className="text-2xl font-bold text-green-600 mb-2 text-center">곁에</h1>
        <p className="text-gray-500 text-sm text-center mb-8">부모님의 매일 아침 친구</p>

        <div className="bg-green-50 rounded-xl p-6 mb-6 text-center">
          <p className="text-sm text-gray-400 line-through mb-1">월 5,900원</p>
          <p className="text-3xl font-bold text-green-600">월 4,900원</p>
          <p className="text-xs text-green-500 mt-1">지금 가입하면 영구 적용</p>
        </div>

        <ul className="text-sm text-gray-600 space-y-2 mb-8">
          <li>✅ 매일 아침 카카오 안부 메시지</li>
          <li>✅ AI 말동무 대화</li>
          <li>✅ 미응답 자녀 즉시 알림</li>
          <li>✅ 복약 알림</li>
          <li>✅ 주간·월간 AI 리포트</li>
        </ul>

        <button
          onClick={handlePayment}
          disabled={loading}
          className="w-full bg-green-500 text-white py-4 rounded-xl font-bold text-lg disabled:opacity-50"
        >
          {loading ? '처리 중...' : '지금 시작하기'}
        </button>

        <p className="text-xs text-gray-400 text-center mt-4">
          언제든 해지 가능 · 다음 결제일 전 해지 시 환불
        </p>
      </div>
    </main>
  )
}