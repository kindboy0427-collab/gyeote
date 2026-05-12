'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

function PaymentFailContent() {
  const searchParams = useSearchParams()

  const code = searchParams.get('code') ?? 'UNKNOWN_ERROR'
  const message = searchParams.get('message') ?? '결제가 취소되었거나 실패했습니다.'
  const orderId = searchParams.get('orderId')

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm p-8 text-center">
        <div className="text-5xl mb-4">⚠️</div>

        <h1 className="text-2xl font-bold text-gray-800 mb-3">
          결제 실패
        </h1>

        <p className="text-gray-500 text-sm mb-6">
          {message}
        </p>

        <div className="bg-gray-50 rounded-xl p-4 text-left text-xs text-gray-500 mb-6">
          <div>에러 코드: {code}</div>
          {orderId && <div>주문번호: {orderId}</div>}
        </div>

        <div className="space-y-3">
          <Link
            href="/payment"
            className="block w-full bg-green-500 text-white py-3 rounded-xl font-medium"
          >
            다시 결제하기
          </Link>

          <Link
            href="/dashboard"
            className="block w-full border border-gray-200 text-gray-600 py-3 rounded-xl font-medium"
          >
            대시보드로 이동
          </Link>
        </div>
      </div>
    </main>
  )
}

export default function PaymentFailPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-sm p-8 text-center">
            <div className="text-5xl mb-4">⏳</div>
            <h1 className="text-2xl font-bold text-gray-800 mb-3">결제 정보 확인 중</h1>
            <p className="text-gray-500 text-sm">결제 실패 정보를 불러오는 중입니다.</p>
          </div>
        </main>
      }
    >
      <PaymentFailContent />
    </Suspense>
  )
}