'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

function formatTimeLabel(time: string) {
  const [hourText, minuteText] = time.split(':')
  const hour = Number(hourText)
  const minute = Number(minuteText)

  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return time
  }

  const period = hour < 12 ? '오전' : '오후'
  const displayHour = hour % 12 === 0 ? 12 : hour % 12

  return `${period} ${String(displayHour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export default function OnboardPage() {
  const router = useRouter()
  const timeInputRef = useRef<HTMLInputElement | null>(null)

  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    name: '',
    phone: '',
    guardianPhone: '',
    morningTime: '09:00',
    mealCheck: true,
    medication: '',
  })
  const [loading, setLoading] = useState(false)

  const next = () => setStep((s) => s + 1)

  const openTimePicker = () => {
    const input = timeInputRef.current
    if (!input) return

    if (typeof input.showPicker === 'function') {
      input.showPicker()
      return
    }

    input.focus()
    input.click()
  }

  const submit = async () => {
    setLoading(true)

    try {
      const res = await fetch('/api/parents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
  name: form.name,
  phone: form.phone,
  guardianPhone: form.guardianPhone,
  morningTime: form.morningTime,
  mealCheck: form.mealCheck,
  medication: form.medication,
}),
      })

      if (res.ok) {
        setStep(4)
      } else {
        const data = await res.json()
        alert(data?.error || '등록 실패. 다시 시도해주세요.')
        setLoading(false)
      }
    } catch {
      alert('오류가 발생했습니다.')
      setLoading(false)
    }
  }

  const inputClass =
    'w-full border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-400'

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {step < 4 && (
          <div className="flex gap-2 mb-8">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className={`flex-1 h-1.5 rounded-full ${
                  step >= i ? 'bg-green-500' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        )}

        {step === 1 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-800 mb-1">부모님 기본 정보</h2>
            <p className="text-sm text-gray-500 mb-6">
              1/3 · 성함과 전화번호를 입력해주세요
            </p>

            <div className="flex flex-col gap-4">
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">
                  부모님 성함
                </label>
                <input
                  type="text"
                  placeholder="예) 홍길동"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">
                  부모님 전화번호
                </label>
                <input
                  type="tel"
                  placeholder="010-0000-0000"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">
                  보호자 전화번호
                </label>
                <input
                  type="tel"
                  placeholder="010-0000-0000"
                  value={form.guardianPhone}
                  onChange={(e) => setForm({ ...form, guardianPhone: e.target.value })}
                  className={inputClass}
                />
                <p className="text-xs text-gray-400 mt-1.5">
                  3시간 이상 답장이 없을 때 즉각 알림을 받을 번호입니다.
                </p>
              </div>

              <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-xs text-green-700 font-medium">
                부모님 번호로 카카오톡 안부 메시지가 발송됩니다.
              </div>
            </div>

            <button
              onClick={next}
              disabled={!form.name || !form.phone || !form.guardianPhone}
              className="w-full bg-green-500 text-white py-3 rounded-xl font-semibold mt-6 disabled:opacity-40"
            >
              다음
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-800 mb-1">시간 설정</h2>
            <p className="text-sm text-gray-500 mb-6">
              2/3 · 안부 확인 시간을 설정해주세요
            </p>

            <div className="flex flex-col gap-4">
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">
                  아침 안부 시간
                </label>

                <input
                  ref={timeInputRef}
                  type="time"
                  value={form.morningTime}
                  onChange={(e) => setForm({ ...form, morningTime: e.target.value })}
                  className="sr-only"
                  aria-label="아침 안부 시간"
                />

                <div className="w-full border border-gray-300 rounded-xl px-4 py-3 flex items-center justify-between">
                  <span className="text-sm text-gray-900 font-medium">
                    {formatTimeLabel(form.morningTime)}
                  </span>

                  <button
                    type="button"
                    onClick={openTimePicker}
                    className="text-sm font-semibold text-green-600"
                  >
                    시간 변경
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-xl">
                <div>
                  <div className="text-sm font-semibold text-gray-800">
                    점심 식사 확인
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    오후 12시 30분 발송
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setForm({ ...form, mealCheck: !form.mealCheck })}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    form.mealCheck ? 'bg-green-500' : 'bg-gray-200'
                  }`}
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${
                      form.mealCheck ? 'translate-x-6' : ''
                    }`}
                  />
                </button>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">
                  복용 약 <span className="font-normal text-gray-400">(선택)</span>
                </label>
                <input
                  type="text"
                  placeholder="예) 혈압약, 당뇨약"
                  value={form.medication}
                  onChange={(e) => setForm({ ...form, medication: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>

            <button
              onClick={next}
              className="w-full bg-green-500 text-white py-3 rounded-xl font-semibold mt-6"
            >
              다음
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">확인해주세요</h2>

            <div className="text-left bg-gray-50 rounded-xl p-4 mb-6 flex flex-col gap-3">
              {[
                ['성함', form.name],
                ['부모님 전화번호', form.phone],
                ['보호자 전화번호', form.guardianPhone],
                ['아침 안부', formatTimeLabel(form.morningTime)],
                ['식사 확인', form.mealCheck ? 'ON' : 'OFF'],
                ['복용 약', form.medication || '없음'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm gap-4">
                  <span className="text-gray-500 font-medium">{k}</span>
                  <span className="font-semibold text-gray-800 text-right">{v}</span>
                </div>
              ))}
            </div>

            <button
              onClick={submit}
              disabled={loading}
              className="w-full bg-green-500 text-white py-3 rounded-xl font-semibold disabled:opacity-40"
            >
              {loading ? '등록 중...' : '부모님 등록 완료'}
            </button>
          </div>
        )}

        {step === 4 && (
          <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
            <div className="text-6xl mb-5">🎉</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">
              {form.name}님 등록 완료!
            </h2>
            <p className="text-sm text-gray-500 mb-2">
              내일 아침{' '}
              <span className="font-bold text-green-600">
                {formatTimeLabel(form.morningTime)}
              </span>
              에
              <br />
              첫 안부 메시지가 발송돼요.
            </p>
            <p className="text-xs text-gray-400 mb-8">
              카카오톡 채널 ‘곁에’를 통해 메시지가 전송됩니다.
            </p>
            <button
              onClick={() => router.push('/dashboard')}
              className="w-full bg-green-500 text-white py-3 rounded-xl font-semibold"
            >
              대시보드로 이동
            </button>
          </div>
        )}
      </div>
    </main>
  )
}