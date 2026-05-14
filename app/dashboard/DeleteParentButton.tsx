'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function DeleteParentButton({ parentId }: { parentId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    if (!confirm('정말 삭제하시겠어요?')) return
    setLoading(true)
    await fetch(`/api/parents/${parentId}`, { method: 'DELETE' })
    router.refresh()
    setLoading(false)
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="text-xs text-red-400 hover:text-red-600 font-medium disabled:opacity-50"
    >
      {loading ? '삭제 중...' : '삭제'}
    </button>
  )
}