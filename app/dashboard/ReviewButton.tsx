'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function ReviewButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    setLoading(true)
    const res = await fetch('/api/review/token', { method: 'POST' })
    const data = await res.json()
    if (data.token) {
      router.push(`/review?token=${data.token}`)
    }
    setLoading(false)
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="text-sm text-white bg-[#c0845a] px-4 py-2 rounded-xl font-medium disabled:opacity-50"
    >
      {loading ? '준비 중...' : '후기 작성하기 ✏️'}
    </button>
  )
}