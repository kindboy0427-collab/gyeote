'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function RefreshButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleRefresh = () => {
    setLoading(true)
    router.refresh()
    setTimeout(() => setLoading(false), 1000)
  }

  return (
    <button
      onClick={handleRefresh}
      className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
    >
      {loading ? '새로고침 중...' : '🔄 새로고침'}
    </button>
  )
}