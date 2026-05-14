'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function StartTrialButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleStart = async () => {
    setLoading(true)
    const res = await fetch('/api/trial', { method: 'POST' })
    if (res.ok) {
      router.refresh()
    } else {
      alert('오류가 발생했습니다. 다시 시도해주세요.')
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleStart}
      disabled={loading}
      className="bg-blue-500 text-white px-6 py-3 rounded-xl font-semibold disabled:opacity-40"
    >
      {loading ? '시작 중...' : '30일 무료 체험 시작하기'}
    </button>
  )
}