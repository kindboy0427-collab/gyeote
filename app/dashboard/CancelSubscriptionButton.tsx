'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function CancelSubscriptionButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const handleCancel = async () => {
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
      alert(error instanceof Error ? error.message : '구독 해지 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
      setShowConfirm(false)
    }
  }

  if (showConfirm) {
    return (
      <div className="flex flex-col items-end gap-2">
        <p className="text-xs text-gray-500 text-right">
          해지 시 남은 기간까지는 계속 이용 가능해요.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setShowConfirm(false)}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
          >
            취소
          </button>
          <button
            onClick={handleCancel}
            disabled={loading}
            className="text-xs px-3 py-1.5 rounded-lg bg-red-500 text-white disabled:opacity-50"
          >
            {loading ? '해지 처리 중...' : '해지 확인'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setShowConfirm(true)}
      className="text-xs text-red-400 underline"
    >
      구독 해지
    </button>
  )
}