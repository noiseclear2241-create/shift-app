// サービスワーカー：アプリを閉じていても、届いたプッシュ通知を画面に表示する小さなプログラム。
// サーバーからは「データだけ」のメッセージ（title / body / url）を送り、表示はここで行う。
// （iPhone では、届いたプッシュは必ず通知として表示する必要があるため、常に表示する）

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { data: { body: event.data ? event.data.text() : '' } };
  }
  // Firebase Cloud Messaging の形式（{ data: {...} } または { notification: {...} }）に対応
  const data = payload.data || {};
  const n = payload.notification || {};
  const title = data.title || n.title || 'シフト手帳';
  const options = {
    body: data.body || n.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: data.tag || undefined, // 同じ tag の通知は上書きされる（重複表示の防止）
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// 通知を押したら、アプリの該当画面を開く（すでに開いていればその画面に切り替える）
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (new URL(w.url).origin === self.location.origin) {
          return w
            .focus()
            .then(() => w.navigate(url))
            .catch(() => self.clients.openWindow(url));
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
