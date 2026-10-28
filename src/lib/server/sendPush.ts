// サーバー専用：ユーザーの登録端末すべてにプッシュ通知を送る。
// 届かなくなった端末（アプリ削除・通知オフなど）の登録は、ここで自動的に消す。

import type { App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

export interface PushMessage {
  title: string;
  body: string;
  url: string;
  /** 同じ tag の通知は端末上で上書きされる */
  tag?: string;
}

/** もう届かないトークンを表すエラー */
const GONE = new Set(['messaging/registration-token-not-registered', 'messaging/invalid-registration-token']);

export async function sendPushToUser(app: App, uid: string, msg: PushMessage) {
  const devices = await getFirestore(app).collection('users').doc(uid).collection('devices').get();
  const targets = devices.docs
    .map((d) => ({ ref: d.ref, token: d.get('token') as string | undefined }))
    .filter((t): t is { ref: typeof t.ref; token: string } => !!t.token);
  if (targets.length === 0) return { sent: 0, failed: 0, removed: 0 };

  // 「データだけ」のメッセージにして、表示は端末側のサービスワーカー（public/sw.js）が行う
  const res = await getMessaging(app).sendEachForMulticast({
    tokens: targets.map((t) => t.token),
    data: { title: msg.title, body: msg.body, url: msg.url, tag: msg.tag ?? '' },
    webpush: { headers: { Urgency: 'high', TTL: String(60 * 60 * 12) } },
  });

  let removed = 0;
  await Promise.all(
    res.responses.map(async (r, i) => {
      if (!r.success && r.error && GONE.has(r.error.code)) {
        await targets[i].ref.delete();
        removed++;
      }
    }),
  );
  return { sent: res.successCount, failed: res.failureCount, removed };
}
