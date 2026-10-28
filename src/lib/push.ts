// この端末をプッシュ通知の受け取り先として登録・解除する処理（ブラウザ側）。
// 登録先：users/{uid}/devices/{端末ID}。端末IDは通知用トークンから作る（トークンそのものを ID にしない）。

import { deleteDoc, doc, setDoc } from 'firebase/firestore';
import { deleteToken, getMessaging, getToken, isSupported } from 'firebase/messaging';
import { getFirebase } from './firebase';

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
const DEVICE_KEY = 'shiftapp:push-device-id';

export type PushStatus =
  | 'not-configured' // 管理者側の設定（VAPID キー）がまだ
  | 'needs-home-screen' // iPhone：ホーム画面に追加したアプリから開く必要がある
  | 'unsupported' // この端末・ブラウザは非対応
  | 'denied' // 通知がブロックされている
  | 'off' // 受け取れるが、まだ登録していない
  | 'on'; // この端末は登録済み

const isIos = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

const savedDeviceId = () => {
  try {
    return localStorage.getItem(DEVICE_KEY);
  } catch {
    return null;
  }
};

export async function getPushStatus(): Promise<PushStatus> {
  if (!VAPID_KEY) return 'not-configured';
  if (isIos() && !isStandalone()) return 'needs-home-screen';
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !(await isSupported())) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  return Notification.permission === 'granted' && savedDeviceId() ? 'on' : 'off';
}

async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** 通知用トークンを取得して、users/{uid}/devices に保存する */
async function saveDevice(uid: string) {
  const { app, db } = getFirebase();
  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const token = await getToken(getMessaging(app), { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
  const id = await sha256(token);
  await setDoc(
    doc(db, 'users', uid, 'devices', id),
    {
      token,
      platform: isIos() ? 'ios' : /Android/.test(navigator.userAgent) ? 'android' : 'other',
      userAgent: navigator.userAgent.slice(0, 300),
      lastSeen: Date.now(),
    },
    { merge: true },
  );
  // 以前の登録とトークンが変わっていたら、古い登録は消す
  const prev = savedDeviceId();
  if (prev && prev !== id) await deleteDoc(doc(db, 'users', uid, 'devices', prev)).catch(() => {});
  localStorage.setItem(DEVICE_KEY, id);
}

/** 「この端末で通知を受け取る」ボタン。通知の許可を求めてから登録する（必ずボタン操作から呼ぶ） */
export async function enablePush(uid: string) {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('通知が許可されませんでした');
  await saveDevice(uid);
}

/** 登録済みの端末で、アプリを開いたときにトークンを最新にしておく（トークンは時々変わるため） */
export async function refreshPush(uid: string) {
  if ((await getPushStatus()) !== 'on') return;
  await saveDevice(uid);
}

export async function disablePush(uid: string) {
  const { app, db } = getFirebase();
  const id = savedDeviceId();
  if (id) await deleteDoc(doc(db, 'users', uid, 'devices', id));
  await deleteToken(getMessaging(app)).catch(() => {});
  localStorage.removeItem(DEVICE_KEY);
}

/** ログイン証明を付けてサーバーの通知処理を呼ぶ */
async function callNotifyApi<T>(path: string): Promise<T> {
  const user = getFirebase().auth.currentUser;
  if (!user) throw new Error('ログインしていません');
  const res = await fetch(path, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await user.getIdToken()}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `送信に失敗しました（${res.status}）`);
  return body;
}

/** サーバーに、自分の登録端末すべてへテスト通知を送ってもらう */
export const sendTestPush = () => callNotifyApi<{ sent: number; failed: number }>('/api/notify/test');

/** 毎朝の自動送信と同じ通知を、今すぐ自分の分だけ送ってもらう */
export const sendMorningNow = () =>
  callNotifyApi<{ total: number; sent: number; skipped: number }>('/api/notify/morning');
