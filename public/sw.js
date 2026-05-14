self.addEventListener('push', function(event) {
  let title = '곁에'
  let body = '부모님 안부를 확인해주세요.'
  let url = '/'

  if (event.data) {
    try {
      const data = event.data.json()
      title = data.title || title
      body = data.body || body
      url = data.url || url
    } catch (e) {
      body = event.data.text() || body
    }
  }

  const options = {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: url,
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', function(event) {
  event.notification.close()
  event.waitUntil(clients.openWindow(event.notification.data || '/'))
})