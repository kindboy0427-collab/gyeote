'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'

export default function MessagePage() {
  const params = useParams()
  const id = params.id as string
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!message.trim()) return
    setLoading(true)
    try {
      const res = await fetch(`/api/message/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })
      if (res.ok) setSent(true)
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#fdf8f3] px-6">
        <div className="text-center">
          <div className="text-5xl mb-6">💌</div>
          <h1 className="text-xl font-semibold text-gray-800 mb-3">
            소중한 마음이 전달됐어요
          </h1>
          <p className="text-gray-500 text-sm">
            자녀분께 따뜻한 마음이 전해졌어요 😊
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#fdf8f3] px-6 py-12">
      <div className="max-w-md mx-auto w-full">
        <div className="text-center mb-8">
          <div className="text-4xl mb-4">💌</div>
          <h1 className="text-xl font-semibold text-gray-800 mb-2">
            자녀에게 마음을 전해보세요
          </h1>
          <p className="text-gray-500 text-sm">
            짧은 한 마디도 괜찮아요
          </p>
        </div>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="전하고 싶은 말을 자유롭게 적어주세요..."
          className="w-full h-40 p-4 rounded-2xl border border-gray-200 bg-white text-gray-800 text-sm resize-none focus:outline-none focus:border-green-400"
        />

        <button
          onClick={handleSubmit}
          disabled={loading || !message.trim()}
          className="mt-4 w-full py-4 rounded-2xl bg-green-500 text-white font-semibold text-base disabled:opacity-50"
        >
          {loading ? '전송 중...' : '자녀에게 전하기 💌'}
        </button>
      </div>
    </div>
  )
}