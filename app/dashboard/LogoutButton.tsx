'use client'

import { signOut } from 'next-auth/react'

export default function LogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/' })}
      className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm text-gray-500 hover:bg-gray-200"
      title="로그아웃"
    >
      ↩
    </button>
  )
}