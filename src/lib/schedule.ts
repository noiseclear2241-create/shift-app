// 日付計算と「次の出勤」「今日の予定」を決めるロジック。
// 画面から切り離した純粋な関数にして、テストで確かめられるようにしている。
// 日付はすべて利用者の端末のタイムゾーン（ブラウザの現地時刻）で扱う。

import type { Deadline, EventItem, Shift, Task, TaskStatus } from './types';

/**
 * 見ている人の情報。個人用スペースでは全部が「自分の」予定。
 * チームでは、担当に自分が割り当てられた出勤・タスクだけが「自分の」予定。
 */
export interface Viewer {
  uid: string;
  personal: boolean;
}

export const isMyShift = (s: Shift, v: Viewer) => v.personal || s.assigneeUid === v.uid;

export const isMyTask = (t: Task, v: Viewer) => v.personal || !t.assigneeUid || t.assigneeUid === v.uid;

/** start〜end の日付の一覧（両端を含む。最大 maxDays 日） */
export function datesInRange(start: string, end: string, maxDays = 62): string[] {
  const list: string[] = [];
  for (let d = start; d && d <= end && list.length < maxDays; d = addDays(d, 1)) list.push(d);
  return list;
}

export const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

const pad = (n: number) => String(n).padStart(2, '0');

/** Date → 'YYYY-MM-DD'（現地時刻） */
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Date → 'HH:mm'（現地時刻） */
export function hm(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 'YYYY-MM-DD' → その日の現地時刻0時 */
export function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: string, n: number): string {
  const d = parseYmd(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
}

/** b - a の日数（夏時間の影響を受けないよう UTC で計算） */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

/** '2026-10-26' → '10月26日(月)'。withYear で年も付ける */
export function formatDateJa(s: string, withYear = false): string {
  if (!s) return '';
  const d = parseYmd(s);
  const base = `${d.getMonth() + 1}月${d.getDate()}日(${WEEKDAYS[d.getDay()]})`;
  return withYear ? `${d.getFullYear()}年${base}` : base;
}

export function formatPeriod(start: string, end: string): string {
  if (!start) return '';
  if (!end || end === start) return formatDateJa(start);
  return `${formatDateJa(start)}〜${formatDateJa(end)}`;
}

export function formatTimeRange(start: string, end: string): string {
  if (!start && !end) return '時間未定';
  const overnight = start && end && end <= start;
  return `${start || '?'}〜${overnight ? '翌' : ''}${end || '?'}`;
}

export interface Now {
  date: string;
  time: string;
}

export function toNow(d: Date): Now {
  return { date: ymd(d), time: hm(d) };
}

/** 'YYYY-MM-DD' と 'HH:mm' を並べて比較できる文字列にする */
const stamp = (date: string, time: string) => `${date}T${time || '00:00'}`;

/** 出勤の終了日時（終了が開始以前なら翌日。終了未入力ならその日の終わり） */
export function shiftEnd(s: Shift): string {
  if (!s.endTime) return stamp(s.date, '23:59');
  const overnight = s.startTime && s.endTime <= s.startTime;
  return stamp(overnight ? addDays(s.date, 1) : s.date, s.endTime);
}

export type ShiftPhase = 'upcoming' | 'working' | 'finished';

export function shiftPhase(s: Shift, now: Now): ShiftPhase {
  const n = stamp(now.date, now.time);
  if (n >= shiftEnd(s)) return 'finished';
  if (n >= stamp(s.date, s.startTime)) return 'working';
  return 'upcoming';
}

const byStart = (a: Shift, b: Shift) =>
  stamp(a.date, a.startTime).localeCompare(stamp(b.date, b.startTime));

/**
 * 次の出勤：確定済みで、まだ終わっていない最も早い出勤。
 * 未確定・キャンセルは対象にしない（古い情報や不確かな予定を「次の出勤」と見せないため）。
 */
export function findNextShift(shifts: Shift[], now: Now): Shift | null {
  return (
    shifts
      .filter((s) => s.status === 'confirmed' && shiftPhase(s, now) !== 'finished')
      .sort(byStart)[0] ?? null
  );
}

/** 今後の出勤一覧：キャンセル以外で、まだ終わっていないもの（未確定も状態付きで含める） */
export function upcomingShifts(shifts: Shift[], now: Now): Shift[] {
  return shifts
    .filter((s) => s.status !== 'cancelled' && shiftPhase(s, now) !== 'finished')
    .sort(byStart);
}

export function sortShifts(shifts: Shift[]): Shift[] {
  return [...shifts].sort(byStart);
}

/** 出勤までの日数の表示 */
export function countdownLabel(date: string, now: Now): string {
  const diff = daysBetween(now.date, date);
  if (diff <= 0) return '本日';
  if (diff === 1) return '明日';
  return `あと${diff}日`;
}

export type AgendaStatus = 'done' | 'doing' | 'todo';

export interface AgendaItem {
  key: string;
  kind: 'shift' | 'task' | 'deadline';
  id: string;
  time: string; // 空なら時間指定なし
  title: string;
  detail: string;
  status: AgendaStatus;
  tentative?: boolean;
}

/** 今日の予定：今日の出勤・今日のタスク・今日が期限の項目を時刻順に並べる */
export function todayAgenda(
  now: Now,
  shifts: Shift[],
  tasks: Task[],
  deadlines: Deadline[],
  events: Map<string, EventItem>,
): AgendaItem[] {
  const items: AgendaItem[] = [];

  for (const s of shifts) {
    if (s.date !== now.date || s.status === 'cancelled') continue;
    const ev = events.get(s.eventId);
    const phase = shiftPhase(s, now);
    items.push({
      key: `shift-${s.id}`,
      kind: 'shift',
      id: s.id,
      time: s.startTime,
      title: `出勤：${ev?.venue || '会場未設定'}`,
      detail: [formatTimeRange(s.startTime, s.endTime), ev?.name, s.role].filter(Boolean).join(' ・ '),
      status: phase === 'finished' ? 'done' : phase === 'working' ? 'doing' : 'todo',
      tentative: s.status === 'tentative',
    });
  }

  for (const t of tasks) {
    if (t.date !== now.date) continue;
    items.push({
      key: `task-${t.id}`,
      kind: 'task',
      id: t.id,
      time: t.time,
      title: t.title,
      detail: t.notes,
      status: t.status,
    });
  }

  for (const d of deadlines) {
    if (d.date !== now.date) continue;
    items.push({
      key: `deadline-${d.id}`,
      kind: 'deadline',
      id: d.id,
      time: d.time,
      title: `期限：${d.title}`,
      detail: d.notes,
      status: d.done ? 'done' : 'todo',
    });
  }

  // 時刻のあるものを時刻順に、時間指定なしは最後に
  return items.sort((a, b) => {
    if (!a.time && !b.time) return 0;
    if (!a.time) return 1;
    if (!b.time) return -1;
    return a.time.localeCompare(b.time);
  });
}

/** 今日の予定のうち、これから始まる最初のもの（強調表示用） */
export function nextAgendaItem(items: AgendaItem[], now: Now): AgendaItem | null {
  return items.find((i) => i.status !== 'done' && i.time && i.time >= now.time) ?? null;
}

export interface UrgentItem {
  key: string;
  kind: 'deadline' | 'task';
  id: string;
  title: string;
  date: string;
  time: string;
  overdue: boolean;
  daysLeft: number;
}

/** 期限が近い（withinDays日以内）・過ぎている未完了の項目 */
export function urgentItems(
  now: Now,
  deadlines: Deadline[],
  tasks: Task[],
  withinDays = 7,
): UrgentItem[] {
  const items: UrgentItem[] = [];
  const isOverdue = (date: string, time: string) =>
    date < now.date || (date === now.date && !!time && time < now.time);

  for (const d of deadlines) {
    if (d.done || !d.date) continue;
    const left = daysBetween(now.date, d.date);
    if (left > withinDays) continue;
    items.push({
      key: `deadline-${d.id}`,
      kind: 'deadline',
      id: d.id,
      title: d.title,
      date: d.date,
      time: d.time,
      overdue: isOverdue(d.date, d.time),
      daysLeft: left,
    });
  }

  // タスクは「今日の予定」に出るので、ここでは期限切れのものだけ
  for (const t of tasks) {
    if (t.status === 'done' || !t.date || t.date >= now.date) continue;
    items.push({
      key: `task-${t.id}`,
      kind: 'task',
      id: t.id,
      title: t.title,
      date: t.date,
      time: t.time,
      overdue: true,
      daysLeft: daysBetween(now.date, t.date),
    });
  }

  return items.sort((a, b) => stamp(a.date, a.time).localeCompare(stamp(b.date, b.time)));
}

export function nextTaskStatus(s: TaskStatus): TaskStatus {
  return s === 'todo' ? 'doing' : s === 'doing' ? 'done' : 'todo';
}

/** 会場名から決まる色（会場ごとに見分けやすくするため） */
const VENUE_COLORS = ['#2563eb', '#db2777', '#059669', '#d97706', '#7c3aed', '#0891b2', '#dc2626', '#4d7c0f'];
export function venueColor(venue: string): string {
  let h = 0;
  for (const ch of venue) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return VENUE_COLORS[h % VENUE_COLORS.length];
}
