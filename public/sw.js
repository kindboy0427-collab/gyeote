self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : {}
  const title = data.title || '곁에'
  const options = {
    body: data.body || '부모님 안부를 확인해주세요.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: data.url || '/',
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', function(event) {
  event.notification.close()
  event.waitUntil(clients.openWindow(event.notification.data || '/'))
})