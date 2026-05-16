'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function StartTrialButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showInput, setShowInput] = useState(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')

  const handleStart = async () => {
    if (!code.trim()) {
      setError('초대 코드를 입력해주세요.')
      return
    }

    setLoading(true)
    setError('')

    const res = await fetch('/api/trial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code.trim() }),
    })

    const data = await res.json()

    if (res.ok) {
      router.refresh()
    } else {
      setError(data?.error || '오류가 발생했습니다.')
      setLoading(false)
    }
  }

  if (!showInput) {
    return (
      <button
        onClick={() => setShowInput(true)}
        className="shrink-0 bg-blue-500 text-white px-6 py-3 rounded-xl font-semibold"
      >
        7일 무료 체험 시작하기
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-2 shrink-0">
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="초대 코드 입력"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          className="border border-gray-300 rounded-xl px-4 py-2 text-sm w-40 focus:outline-none focus:border-blue-400"
        />
        <button
          onClick={handleStart}
          disabled={loading}
          className="bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
        >
          {loading ? '시작 중...' : '확인'}
        </button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}