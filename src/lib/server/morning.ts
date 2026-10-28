// サーバー専用：毎朝の通知を作って送る。
// 中身の決め方は画面の「届く予定の通知」と同じ buildMorningNotifications を使う。

import type { App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { buildMorningNotifications, todayIn } from '../notifications';
import {
  DEFAULT_NOTIFICATION_PREFS,
  type Deadline,
  type EventItem,
  type NotificationPrefs,
  type Shift,
  type Task,
} from '../types';
import { sendPushToUser } from './sendPush';

/** Firestore の「すでに存在します」エラー */
const ALREADY_EXISTS = 6;

/** 1人分：今朝の通知を作って、まだ送っていないものだけ送る */
export async function runMorningForUser(app: App, uid: string, at: Date = new Date()) {
  const db = getFirestore(app);
  const user = (await db.doc(`users/${uid}`).get()).data() ?? {};
  const prefs: NotificationPrefs = { ...DEFAULT_NOTIFICATION_PREFS, ...(user.notifications ?? {}) };
  const today = todayIn(user.timezone || 'Asia/Tokyo', at);

  // users/{uid} は本人が書き換えられるため、指定された作業スペースのメンバーかを必ず確かめる
  const wid: string = user.workspaceId || uid;
  const ws = db.collection('workspaces').doc(wid);
  const members = (await ws.get()).get('members') ?? {};
  if (!(uid in members)) return { today, total: 0, sent: 0, skipped: 0 };

  const read = async <T>(name: string) =>
    (await ws.collection(name).get()).docs.map((d) => ({ ...d.data(), id: d.id }) as T);
  const [events, shifts, tasks, deadlines] = await Promise.all([
    read<EventItem>('events'),
    read<Shift>('shifts'),
    read<Task>('tasks'),
    read<Deadline>('deadlines'),
  ]);

  const list = buildMorningNotifications(
    today,
    { shifts, tasks, deadlines, eventMap: new Map(events.map((e) => [e.id, e])) },
    prefs,
  );

  let sent = 0;
  let skipped = 0;
  for (const n of list) {
    // 二重送信の防止：送信記録を「新規作成」できたときだけ送る（同じ通知は二度送らない）
    const logRef = ws.collection('notificationLog').doc(`${uid}_${n.key}`.replace(/\//g, '_'));
    try {
      await logRef.create({ uid, key: n.key, kind: n.kind, date: today, sentAt: Date.now() });
    } catch (e) {
      if ((e as { code?: number }).code === ALREADY_EXISTS) {
        skipped++;
        continue;
      }
      throw e;
    }
    const r = await sendPushToUser(app, uid, { title: n.title, body: n.body, url: n.url, tag: n.key });
    if (r.sent > 0) sent++;
    else await logRef.delete(); // 1台も届かなかったら記録を消して、次回また送れるようにする
  }
  return { today, total: list.length, sent, skipped };
}

/** 全員分：通知を受け取る端末を登録している人にだけ送る */
export async function runMorningForAll(app: App, at: Date = new Date()) {
  const devices = await getFirestore(app).collectionGroup('devices').get();
  const uids = [...new Set(devices.docs.map((d) => d.ref.parent.parent?.id).filter((id): id is string => !!id))];

  let sent = 0;
  let failedUsers = 0;
  for (const uid of uids) {
    try {
      sent += (await runMorningForUser(app, uid, at)).sent;
    } catch (e) {
      failedUsers++;
      console.error('morning notification failed', uid, e);
    }
  }
  return { users: uids.length, sent, failedUsers };
}
