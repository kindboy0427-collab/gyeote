'use client'

import { useEffect } from 'react'

export default function PushInit() {
  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.register('/sw.js').then(async (reg) => {
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') return

        const existing = await reg.pushManager.getSubscription()
        if (existing) return

        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        })

        await fetch('/api/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sub),
        })
      })
    }
  }, [])

  return null
}