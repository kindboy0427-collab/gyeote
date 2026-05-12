'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

type Status = 'loading' | 'success' | 'error'

function PaymentSuccessContent() {
  const searchParams = useSearchParams()
  const calledRef = useRef(false)

  const [status, setStatus] = useState<Status>('loading')
  const [message, setMessage] = useState('구독 결제를 확인하고 있습니다.')

  useEffect(() => {
    if (calledRef.current) return
    calledRef.current = true

    async function confirmPayment() {
      try {
        const provider = searchParams.get('provider')
        const plan = searchParams.get('plan') === 'yearly' ? 'yearly' : 'monthly'

        if (provider === 'KAKAO_PAY') {
          const pgToken = searchParams.get('pg_token')
          const orderId = searchParams.get('orderId')

          if (!pgToken || !orderId) {
            throw new Error('카카오페이 승인에 필요한 정보가 부족합니다.')
          }

          const res = await fetch('/api/payments/kakaopay/approve', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              pgToken,
              orderId,
              plan,
            }),
          })

          const data = await res.json()

          if (!res.ok) {
            throw new Error(data?.error || '카카오페이 결제 승인에 실패했습니다.')
          }

          setStatus('success')
          setMessage(
            plan === 'yearly'
              ? '연간 구독이 활성화되었습니다. 매년 자동 결제됩니다.'
              : '월간 구독이 활성화되었습니다. 매월 자동 결제됩니다.'
          )
          return
        }

        if (provider === 'TOSS') {
          const authKey = searchParams.get('authKey')
          const customerKey = searchParams.get('customerKey')

          if (!authKey || !customerKey) {
            throw new Error('토스 자동결제 등록에 필요한 정보가 부족합니다.')
          }

          const res = await fetch('/api/payments/toss/billing/issue', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              authKey,
              customerKey,
              plan,
            }),
          })

          const data = await res.json()

          if (!res.ok) {
            throw new Error(data?.error || '토스 자동결제 등록에 실패했습니다.')
          }

          setStatus('success')
          setMessage(
            plan === 'yearly'
              ? '연간 구독이 활성화되었습니다. 매년 자동 결제됩니다.'
              : '월간 구독이 활성화되었습니다. 매월 자동 결제됩니다.'
          )
          return
        }

        const paymentKey = searchParams.get('paymentKey')
        const orderId = searchParams.get('orderId')
        const amount = searchParams.get('amount')

        if (!paymentKey || !orderId || !amount) {
          throw new Error('결제 승인에 필요한 정보가 부족합니다.')
        }

        const res = await fetch('/api/payment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            paymentKey,
            orderId,
            amount: Number(amount),
          }),
        })

        const data = await res.json()

        if (!res.ok) {
          throw new Error(data?.error || '결제 승인에 실패했습니다.')
        }

        setStatus('success')
        setMessage('결제가 완료되었습니다. 구독이 활성화되었습니다.')
      } catch (error) {
        setStatus('error')
        setMessage(
          error instanceof Error
            ? error.message
            : '구독 결제 처리 중 오류가 발생했습니다.'
        )
      }
    }

    confirmPayment()
  }, [searchParams])

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm p-8 text-center">
        <div className="text-5xl mb-4">
          {status === 'loading' && '⏳'}
          {status === 'success' && '✅'}
          {status === 'error' && '⚠️'}
        </div>

        <h1 className="text-2xl font-bold text-gray-800 mb-3">
          {status === 'loading' && '구독 결제 확인 중'}
          {status === 'success' && '구독 활성화 완료'}
          {status === 'error' && '구독 결제 처리 실패'}
        </h1>

        <p className="text-gray-500 text-sm mb-6">{message}</p>

        {status === 'success' && (
          <Link
            href="/dashboard"
            className="block w-full bg-green-500 text-white py-3 rounded-xl font-medium"
          >
            대시보드로 이동
          </Link>
        )}

        {status === 'error' && (
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
        )}
      </div>
    </main>
  )
}

export default function PaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-sm p-8 text-center">
            <div className="text-5xl mb-4">⏳</div>
            <h1 className="text-2xl font-bold text-gray-800 mb-3">
              구독 결제 확인 중
            </h1>
            <p className="text-gray-500 text-sm">
              결제 정보를 불러오는 중입니다.
            </p>
          </div>
        </main>
      }
    >
      <PaymentSuccessContent />
    </Suspense>
  )
}