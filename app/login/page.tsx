'use client'
import { signIn } from 'next-auth/react'
import { useState } from 'react'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)

  const handleLogin = () => {
    setLoading(true)
    signIn('kakao', { callbackUrl: '/dashboard' })
  }

  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-3xl font-bold text-green-600 mb-2">곁에</h1>
        <p className="text-gray-500 mb-12">부모님의 매일 아침 안부</p>
        <div className="bg-gray-50 rounded-2xl p-8">
          <p className="text-gray-700 font-medium mb-6">카카오 계정으로 시작해주세요</p>
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-yellow-400 text-gray-800 font-bold py-4 rounded-xl flex items-center justify-center gap-3 disabled:opacity-70"
          >
            {loading ? (
              <span className="text-sm">카카오 로그인 중...</span>
            ) : (
              <>
                <span className="text-xl">💬</span>
                카카오로 로그인
              </>
            )}
          </button>
          <p className="text-xs text-gray-400 mt-4">
            로그인 시 서비스 이용약관에 동의하게 됩니다.
          </p>
        </div>
      </div>
    </main>
  )
}