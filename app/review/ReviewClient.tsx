'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

function ReviewForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [content, setContent] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error' | 'invalid' | 'no-subscription'>('idle')
  const [userName, setUserName] = useState('')
  const [sessionToken, setSessionToken] = useState<string | null>(null)

  useEffect(() => {
    if (token) {
      // 알림톡 링크로 접속한 경우 — 토큰으로 검증
      fetch(`/api/review/verify?token=${token}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.name) {
            setUserName(data.name)
            setSessionToken(token)
          } else {
            setStatus('invalid')
          }
        })
        .catch(() => setStatus('invalid'))
    } else {
      // 직접 접속한 경우 — 세션 + 구독 이력 확인
      fetch('/api/review/token', { method: 'POST' })
        .then((r) => r.json())
        .then((data) => {
          if (data.token) {
            setSessionToken(data.token)
            setUserName(data.name ?? '')
          } else if (data.error === 'no-subscription') {
            setStatus('no-subscription')
          } else {
            setStatus('invalid')
          }
        })
        .catch(() => setStatus('invalid'))
    }
  }, [token])

  const handleSubmit = async () => {
    if (rating === 0 || content.trim().length < 5) return
    setStatus('loading')

    const res = await fetch('/api/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: sessionToken, rating, content }),
    })

    if (res.ok) setStatus('done')
    else setStatus('error')
  }

  if (status === 'invalid') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fdf9f5]">
        <div className="text-center px-6">
          <div className="text-5xl mb-4">🍂</div>
          <p className="text-gray-500 text-base">유효하지 않은 링크예요.</p>
          <p className="text-gray-400 text-sm mt-2">링크가 만료됐거나 이미 사용된 링크예요.</p>
        </div>
      </div>
    )
  }

  if (status === 'no-subscription') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fdf9f5]">
        <div className="text-center px-6 max-w-sm">
          <div className="text-5xl mb-4">🌿</div>
          <p className="text-gray-700 text-base font-medium">서비스 이용 후 작성 가능해요.</p>
          <p className="text-gray-400 text-sm mt-2">곁에 서비스를 이용하신 분만 후기를 남길 수 있어요.</p>
        </div>
      </div>
    )
  }

  if (status === 'done') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fdf9f5]">
        <div className="text-center px-6 max-w-sm">
          <div className="text-6xl mb-5 animate-bounce">🎁</div>
          <h2 className="text-2xl font-bold text-[#3d2c1e] mb-3" style={{ fontFamily: "'Noto Serif KR', serif" }}>
            소중한 후기 감사해요
          </h2>
          <p className="text-[#7c5c3e] text-base leading-relaxed">
            7일 무료 연장이 완료됐어요.<br />
            앞으로도 항상 곁에 있을게요 🌿
          </p>
          <div className="mt-8 py-4 px-6 bg-white rounded-2xl shadow-sm border border-[#ede0d4]">
            <p className="text-xs text-[#b08a6e]">연장된 서비스는 대시보드에서 확인할 수 있어요</p>
          </div>
        </div>
      </div>
    )
  }

  // 토큰 아직 없으면 로딩
  if (!sessionToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fdf9f5]">
        <p className="text-[#b08a6e] text-sm">확인 중...</p>
      </div>
    )
  }

  const stars = [1, 2, 3, 4, 5]
  const starLabels = ['별로예요', '아쉬워요', '보통이에요', '좋아요', '최고예요']

  return (
    <div className="min-h-screen bg-[#fdf9f5] flex flex-col">
      <div className="px-6 pt-12 pb-6 text-center">
        <div className="inline-flex items-center gap-2 mb-5">
          <span className="text-2xl">🌿</span>
          <span className="text-xl font-bold text-[#3d2c1e]" style={{ fontFamily: "'Noto Serif KR', serif" }}>
            곁에
          </span>
        </div>
        {userName && (
          <h1 className="text-[1.45rem] font-bold text-[#3d2c1e] leading-snug" style={{ fontFamily: "'Noto Serif KR', serif" }}>
            {userName}님,<br />서비스는 어떠셨나요?
          </h1>
        )}
        <p className="text-sm text-[#9e7c5e] mt-3 leading-relaxed">
          후기를 남겨주시면 <span className="font-semibold text-[#c0845a]">7일 무료 연장</span>해드려요 🎁
        </p>
      </div>

      <div className="flex-1 px-5 pb-10">
        <div className="bg-white rounded-3xl shadow-sm border border-[#ede0d4] p-6">
          <div className="mb-6 text-center">
            <p className="text-xs text-[#b08a6e] mb-3 font-medium tracking-wide uppercase">별점</p>
            <div className="flex justify-center gap-3 mb-2">
              {stars.map((s) => (
                <button
                  key={s}
                  onClick={() => setRating(s)}
                  onMouseEnter={() => setHoverRating(s)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="text-4xl transition-transform duration-150 hover:scale-110 active:scale-95"
                  style={{ filter: (hoverRating || rating) >= s ? 'none' : 'grayscale(1) opacity(0.3)' }}
                >
                  ⭐
                </button>
              ))}
            </div>
            {(hoverRating || rating) > 0 && (
              <p className="text-sm text-[#c0845a] font-medium mt-1">
                {starLabels[(hoverRating || rating) - 1]}
              </p>
            )}
          </div>

          <div className="border-t border-[#f3e8dc] mb-6" />

          <div className="mb-6">
            <p className="text-xs text-[#b08a6e] mb-3 font-medium tracking-wide uppercase">후기</p>
            <textarea
              className="w-full h-32 resize-none rounded-2xl border border-[#ede0d4] bg-[#fdf9f5] px-4 py-3 text-sm text-[#3d2c1e] placeholder-[#c9a88a] focus:outline-none focus:border-[#c0845a] transition-colors"
              placeholder="서비스를 이용하면서 어떠셨나요? 부모님 반응은 어땠나요? 자유롭게 적어주세요 😊"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={300}
            />
            <p className="text-right text-xs text-[#c9a88a] mt-1">{content.length}/300</p>
          </div>

          <button
            onClick={handleSubmit}
            disabled={rating === 0 || content.trim().length < 5 || status === 'loading'}
            className="w-full py-4 rounded-2xl text-white font-bold text-base transition-all duration-200 disabled:opacity-40"
            style={{
              background: rating > 0 && content.trim().length >= 5 ? 'linear-gradient(135deg, #c0845a, #a06840)' : '#d4b8a0',
              boxShadow: rating > 0 && content.trim().length >= 5 ? '0 4px 15px rgba(192,132,90,0.35)' : 'none',
            }}
          >
            {status === 'loading' ? '저장 중...' : '후기 남기기 🌿'}
          </button>

          {status === 'error' && (
            <p className="text-center text-sm text-red-400 mt-3">오류가 발생했어요. 다시 시도해주세요.</p>
          )}
        </div>

        <p className="text-center text-xs text-[#c9a88a] mt-5 leading-relaxed">
          후기는 서비스 개선에만 사용돼요.<br />
          개인정보는 포함하지 않아도 돼요.
        </p>
      </div>
    </div>
  )
}

export default function ReviewClient() {
  return (
    <Suspense>
      <ReviewForm />
    </Suspense>
  )
}