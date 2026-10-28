// サーバー専用：毎朝の通知を作って送る。
// 中身の決め方は画面の「届く予定の通知」と同じ buildMorningNotifications を使う。
// 個人用スペースとチームのそれぞれについて、その人の分（担当の出勤・タスク、全員向けの期限、未提出のシフト希望）を送る。

import type { App } from 'firebase-admin/app';
import { getFirestore, type DocumentSnapshot } from 'firebase-admin/firestore';
import { buildMorningNotifications, todayIn } from '../notifications';
import { isMyShift, isMyTask, type Viewer } from '../schedule';
import {
  DEFAULT_NOTIFICATION_PREFS,
  type AvailabilityPeriod,
  type Deadline,
  type EventItem,
  type NotificationPrefs,
  type Shift,
  type Task,
} from '../types';
import { sendPushToUser } from './sendPush';

/** Firestore の「すでに存在します」エラー */
const ALREADY_EXISTS = 6;

/** その人が入っている作業スペース（個人用＋チーム）。メンバーであることを必ず確かめる */
async function workspacesOf(app: App, uid: string) {
  const db = getFirestore(app);
  const [personal, teams] = await Promise.all([
    db.collection('workspaces').doc(uid).get(),
    db.collection('workspaces').where('memberUids', 'array-contains', uid).get(),
  ]);
  const map = new Map<string, DocumentSnapshot>();
  for (const s of [personal, ...teams.docs]) {
    if (s.exists && s.get(`members.${uid}`)) map.set(s.id, s);
  }
  return [...map.values()];
}

/** 1つの作業スペースについて、今朝の通知を作って、まだ送っていないものだけ送る */
async function runForWorkspace(
  app: App,
  uid: string,
  ws: DocumentSnapshot,
  today: string,
  prefs: NotificationPrefs,
) {
  const read = async <T>(name: string) =>
    (await ws.ref.collection(name).get()).docs.map((d) => ({ ...d.data(), id: d.id }) as T);
  const [events, shifts, tasks, deadlines, periods] = await Promise.all([
    read<EventItem>('events'),
    read<Shift>('shifts'),
    read<Task>('tasks'),
    read<Deadline>('deadlines'),
    read<AvailabilityPeriod>('availabilityPeriods'),
  ]);
  const isTeam = ws.get('type') === 'team';
  const viewer: Viewer = { uid, personal: !isTeam };

  // 受付中のシフト希望のうち、本人がまだ提出していないもの
  const pendingAvailability: AvailabilityPeriod[] = [];
  for (const p of periods.filter((x) => x.status === 'open')) {
    const answer = await ws.ref.collection('availability').doc(`${p.id}_${uid}`).get();
    if (!answer.exists || !answer.get('submittedAt')) pendingAvailability.push(p);
  }

  const list = buildMorningNotifications(
    today,
    {
      shifts: shifts.filter((s) => isMyShift(s, viewer)),
      tasks: tasks.filter((t) => isMyTask(t, viewer)),
      deadlines,
      eventMap: new Map(events.map((e) => [e.id, e])),
      pendingAvailability,
    },
    prefs,
    isTeam ? `【${ws.get('name')}】` : '',
  );

  let sent = 0;
  let skipped = 0;
  for (const n of list) {
    // 二重送信の防止：送信記録を「新規作成」できたときだけ送る（同じ通知は二度送らない）
    const logRef = ws.ref.collection('notificationLog').doc(`${uid}_${n.key}`.replace(/\//g, '_'));
    try {
      await logRef.create({ uid, key: n.key, kind: n.kind, date: today, sentAt: Date.now() });
    } catch (e) {
      if ((e as { code?: number }).code === ALREADY_EXISTS) {
        skipped++;
        continue;
      }
      throw e;
    }
    const r = await sendPushToUser(app, uid, { title: n.title, body: n.body, url: n.url, tag: `${ws.id}:${n.key}` });
    if (r.sent > 0) sent++;
    else await logRef.delete(); // 1台も届かなかったら記録を消して、次回また送れるようにする
  }
  return { total: list.length, sent, skipped };
}

/** 1人分：入っているすべての作業スペースについて、今朝の通知を送る */
export async function runMorningForUser(app: App, uid: string, at: Date = new Date()) {
  const user = (await getFirestore(app).doc(`users/${uid}`).get()).data() ?? {};
  const prefs: NotificationPrefs = { ...DEFAULT_NOTIFICATION_PREFS, ...(user.notifications ?? {}) };
  const today = todayIn(user.timezone || 'Asia/Tokyo', at);

  const result = { today, total: 0, sent: 0, skipped: 0 };
  for (const ws of await workspacesOf(app, uid)) {
    const r = await runForWorkspace(app, uid, ws, today, prefs);
    result.total += r.total;
    result.sent += r.sent;
    result.skipped += r.skipped;
  }
  return result;
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
