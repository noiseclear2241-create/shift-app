// 毎朝の通知の中身を決めるロジック。
// 設定画面の「届く通知のプレビュー」と、段階3のサーバーからの自動送信で同じものを使う。

import { addDays, daysBetween, formatDateJa, formatTimeRange, sortShifts, type Now } from './schedule.ts';
import type { AvailabilityPeriod, Deadline, EventItem, NotificationPrefs, Shift, Task } from './types';

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
 * shifts・tasks は、呼び出す側で「その人の分」に絞ってから渡す（isMyShift / isMyTask）。
 * pendingAvailability には、受付中でその人がまだ提出していないシフト希望の受付だけを渡す。
 * prefix はチーム名など、通知のタイトルの先頭に付ける文字（例：「【〇〇チーム】」）。
 */
export function buildMorningNotifications(
  today: string,
  data: {
    shifts: Shift[];
    tasks: Task[];
    deadlines: Deadline[];
    eventMap: Map<string, EventItem>;
    pendingAvailability?: AvailabilityPeriod[];
  },
  prefs: NotificationPrefs,
  prefix = '',
): MorningNotification[] {
  const list: MorningNotification[] = [];
  const venueOf = (s: Shift) => data.eventMap.get(s.eventId)?.venue || '会場未設定';
  const whenLabel = (left: number) => (left === 0 ? '今日まで' : left === 1 ? '明日まで' : `あと${left}日`);

  if (prefs.deadline) {
    for (const p of data.pendingAvailability ?? []) {
      if (p.status !== 'open' || !p.deadlineDate) continue;
      const left = daysBetween(today, p.deadlineDate);
      if (!DEADLINE_REMIND_DAYS.includes(left)) continue;
      list.push({
        key: `avail:${p.id}:${p.deadlineDate}:${left}`,
        kind: 'deadline',
        title: `シフト希望の提出${whenLabel(left)}：${p.title}`,
        body: `${formatDateJa(p.deadlineDate)}${p.deadlineTime ? ` ${p.deadlineTime}` : ''}まで。アプリから出られる日を提出してください`,
        url: `/availability/${p.id}`,
      });
    }
  }

  if (prefs.deadline) {
    for (const d of data.deadlines) {
      if (d.done || !d.date) continue;
      const left = daysBetween(today, d.date);
      if (!DEADLINE_REMIND_DAYS.includes(left)) continue;
      const when = whenLabel(left);
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

  return prefix ? list.map((n) => ({ ...n, title: `${prefix}${n.title}` })) : list;
}

/**
 * 指定したタイムゾーンでの「今日」（YYYY-MM-DD）。
 * サーバーは世界標準時で動くため、利用者の地域の日付に直してから通知の対象を決める。
 */
export function todayIn(timeZone: string, at: Date = new Date()): string {
  const format = (tz: string) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
  try {
    return format(timeZone);
  } catch {
    return format('Asia/Tokyo'); // 不正なタイムゾーンが保存されていた場合
  }
}

/** 現在時刻から「次の朝の通知」が対象にする日（朝7時より前なら今日、以降なら明日） */
export function nextMorning(now: Now): string {
  return now.time < '07:00' ? now.date : addDays(now.date, 1);
}
