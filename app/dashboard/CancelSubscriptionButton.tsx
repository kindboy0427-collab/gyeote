'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function CancelSubscriptionButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleCancel = async () => {
    if (loading) return

    const confirmed = window.confirm(
      '구독을 해지하시겠습니까? 다음 결제일부터 자동 결제가 중단됩니다.'
    )

    if (!confirmed) return

    setLoading(true)

    try {
      const response = await fetch('/api/subscription/cancel', {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error || '구독 해지에 실패했습니다.')
      }

      alert(data?.message || '구독이 해지되었습니다.')
      router.refresh()
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : '구독 해지 중 오류가 발생했습니다.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleCancel}
      disabled={loading}
      className="text-xs text-red-500 underline disabled:opacity-50"
    >
      {loading ? '해지 처리 중...' : '구독 해지'}
    </button>
  )
}