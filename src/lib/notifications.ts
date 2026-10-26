// 毎朝の通知の中身を決めるロジック。
// 設定画面の「届く通知のプレビュー」と、段階3のサーバーからの自動送信で同じものを使う。

import { addDays, daysBetween, formatDateJa, formatTimeRange, sortShifts, type Now } from './schedule.ts';
import type { Deadline, EventItem, NotificationPrefs, Shift, Task } from './types';

export interface MorningNotification {
  /** 二重送信を防ぐための識別子（同じ key は二度送らない） */
  key: string;
  kind: keyof NotificationPrefs;
  title: string;
  body: string;
  /** 通知を押したときに開く画面 */
  url: string;
}

/** 提出期限を知らせる日（期限までの日数） */
const DEADLINE_REMIND_DAYS = [3, 1, 0];

/**
 * 「today」の朝に送る通知を作る。
 * 出勤は確定のみ・キャンセルは除外（ホーム画面の「次の出勤」と同じ考え方）。
 */
export function buildMorningNotifications(
  today: string,
  data: { shifts: Shift[]; tasks: Task[]; deadlines: Deadline[]; eventMap: Map<string, EventItem> },
  prefs: NotificationPrefs,
): MorningNotification[] {
  const list: MorningNotification[] = [];
  const venueOf = (s: Shift) => data.eventMap.get(s.eventId)?.venue || '会場未設定';

  if (prefs.deadline) {
    for (const d of data.deadlines) {
      if (d.done || !d.date) continue;
      const left = daysBetween(today, d.date);
      if (!DEADLINE_REMIND_DAYS.includes(left)) continue;
      const when = left === 0 ? '今日まで' : left === 1 ? '明日まで' : `あと${left}日`;
      list.push({
        key: `deadline:${d.id}:${d.date}:${left}`,
        kind: 'deadline',
        title: `期限${when}：${d.title}`,
        body: `${formatDateJa(d.date)}${d.time ? ` ${d.time}` : ''}まで${d.notes ? `／${d.notes}` : ''}`,
        url: '/tasks?tab=deadlines',
      });
    }
  }

  if (prefs.nextShift) {
    const tomorrow = addDays(today, 1);
    for (const s of sortShifts(data.shifts)) {
      if (s.date !== tomorrow || s.status !== 'confirmed') continue;
      const ev = data.eventMap.get(s.eventId);
      list.push({
        key: `shift:${s.id}:${s.date}:${s.startTime}`,
        kind: 'nextShift',
        title: `明日は出勤：${venueOf(s)}`,
        body: [
          `${formatDateJa(s.date)} ${formatTimeRange(s.startTime, s.endTime)}`,
          ev?.belongings && `持ち物：${ev.belongings}`,
        ]
          .filter(Boolean)
          .join('／'),
        url: `/shifts/${s.id}`,
      });
    }
  }

  if (prefs.todayDigest) {
    const shifts = sortShifts(data.shifts).filter((s) => s.date === today && s.status === 'confirmed');
    const tasks = data.tasks.filter((t) => t.date === today);
    const open = tasks.filter((t) => t.status !== 'done').length;
    const overdue = data.tasks.filter((t) => t.status !== 'done' && t.date && t.date < today).length;
    const parts = [
      ...shifts.map((s) => `出勤 ${venueOf(s)} ${formatTimeRange(s.startTime, s.endTime)}`),
      tasks.length > 0 && `タスク${tasks.length}件（未完了${open}件）`,
      overdue > 0 && `期限切れのタスク${overdue}件`,
    ].filter(Boolean);
    // 何も予定が無い日は送らない
    if (parts.length > 0) {
      list.push({
        key: `today:${today}`,
        kind: 'todayDigest',
        title: `今日の予定（${formatDateJa(today)}）`,
        body: parts.join('／'),
        url: '/',
      });
    }
  }

  return list;
}

/** 現在時刻から「次の朝の通知」が対象にする日（朝7時より前なら今日、以降なら明日） */
export function nextMorning(now: Now): string {
  return now.time < '07:00' ? now.date : addDays(now.date, 1);
}
