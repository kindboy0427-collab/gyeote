'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function OnboardPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    name: '',
    phone: '',
    morningTime: '09:00',
    mealCheck: true,
    medication: '',
  })
  const [loading, setLoading] = useState(false)

  const next = () => setStep(s => s + 1)

  const submit = async () => {
  setLoading(true)
  try {
    const res = await fetch('/api/parents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        phone: form.phone,
        morningTime: form.morningTime,
        medication: form.medication,
      }),
    })
    if (res.ok) {
      router.push('/dashboard')
    } else {
      alert('등록 실패. 다시 시도해주세요.')
      setLoading(false)
    }
  } catch (e) {
    alert('오류가 발생했습니다.')
    setLoading(false)
  }
}

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* 진행 바 */}
        <div className="flex gap-2 mb-8">
          {[1,2,3].map(i => (
            <div key={i} className={`flex-1 h-1.5 rounded-full ${step >= i ? 'bg-green-500' : 'bg-gray-200'}`} />
          ))}
        </div>

        {step === 1 && (
          <div className="bg-white rounded-2xl p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-1">부모님 기본 정보</h2>
            <p className="text-sm text-gray-500 mb-6">1/3 — 이름과 전화번호를 입력해주세요</p>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">부모님 성함</label>
                <input
                  type="text"
                  placeholder="예: 박순자"
                  value={form.name}
                  onChange={e => setForm({...form, name: e.target.value})}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-400"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">전화번호</label>
                <input
                  type="tel"
                  placeholder="010-0000-0000"
                  value={form.phone}
                  onChange={e => setForm({...form, phone: e.target.value})}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-400"
                />
              </div>
              <div className="bg-green-50 rounded-xl p-3 text-xs text-green-700">
                📱 입력한 번호로 카카오 채널 친구추가 링크가 발송돼요
              </div>
            </div>
            <button
              onClick={next}
              disabled={!form.name || !form.phone}
              className="w-full bg-green-500 text-white py-3 rounded-xl font-medium mt-6 disabled:opacity-40"
            >
              다음
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="bg-white rounded-2xl p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-1">알림 설정</h2>
            <p className="text-sm text-gray-500 mb-6">2/3 — 언제 안부를 드릴까요?</p>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">아침 안부 시간</label>
                <input
                  type="time"
                  value={form.morningTime}
                  onChange={e => setForm({...form, morningTime: e.target.value})}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-400"
                />
              </div>
              <div className="flex items-center justify-between p-3 border border-gray-200 rounded-xl">
                <div>
                  <div className="text-sm font-medium text-gray-800">점심 식사 확인</div>
                  <div className="text-xs text-gray-500">오후 12시 30분 발송</div>
                </div>
                <button
                  onClick={() => setForm({...form, mealCheck: !form.mealCheck})}
                  className={`w-12 h-6 rounded-full transition-colors ${form.mealCheck ? 'bg-green-500' : 'bg-gray-200'}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${form.mealCheck ? 'translate-x-6' : ''}`} />
                </button>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">복약 알림 (선택)</label>
                <input
                  type="text"
                  placeholder="예: 고혈압약, 관절약"
                  value={form.medication}
                  onChange={e => setForm({...form, medication: e.target.value})}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-400"
                />
              </div>
            </div>
            <button onClick={next} className="w-full bg-green-500 text-white py-3 rounded-xl font-medium mt-6">
              다음
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="bg-white rounded-2xl p-6 text-center">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">확인해주세요</h2>
            <div className="text-left bg-gray-50 rounded-xl p-4 mb-6 flex flex-col gap-2">
              {[
                ['성함', form.name],
                ['전화번호', form.phone],
                ['아침 안부', form.morningTime],
                ['식사 확인', form.mealCheck ? 'ON' : 'OFF'],
                ['복약', form.medication || '없음'],
              ].map(([k,v]) => (
                <div key={k} className="flex justify-between text-sm">
                  <span className="text-gray-500">{k}</span>
                  <span className="font-medium text-gray-800">{v}</span>
                </div>
              ))}
            </div>
            <button
              onClick={submit}
              disabled={loading}
              className="w-full bg-green-500 text-white py-3 rounded-xl font-medium"
            >
              {loading ? '등록 중...' : '부모님 등록 완료'}
            </button>
          </div>
        )}
      </div>
    </main>
  )
}