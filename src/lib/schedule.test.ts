import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  countdownLabel,
  daysBetween,
  findNextShift,
  formatDateJa,
  shiftPhase,
  todayAgenda,
  upcomingShifts,
  urgentItems,
} from './schedule.ts';
import type { Deadline, Shift, Task } from './types.ts';

const shift = (p: Partial<Shift>): Shift => ({
  id: 'x',
  eventId: '',
  date: '2026-10-26',
  startTime: '10:00',
  endTime: '19:00',
  staff: '',
  role: '',
  status: 'confirmed',
  notes: '',
  createdAt: 0,
  updatedAt: 0,
  ...p,
});

test('日付計算', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(daysBetween('2026-10-26', '2026-11-02'), 7);
  assert.equal(formatDateJa('2026-10-26'), '10月26日(月)');
});

test('次の出勤は確定済みの最も近いもの。未確定・キャンセル・終了済みは除く', () => {
  const now = { date: '2026-10-26', time: '20:00' };
  const shifts = [
    shift({ id: 'today-finished', date: '2026-10-26' }),
    shift({ id: 'cancelled', date: '2026-10-27', status: 'cancelled' }),
    shift({ id: 'tentative', date: '2026-10-28', status: 'tentative' }),
    shift({ id: 'later', date: '2026-11-05' }),
    shift({ id: 'sooner', date: '2026-10-30' }),
  ];
  assert.equal(findNextShift(shifts, now)?.id, 'sooner');
  assert.deepEqual(
    upcomingShifts(shifts, now).map((s) => s.id),
    ['tentative', 'sooner', 'later'],
  );
  assert.equal(findNextShift([], now), null);
});

test('今日の勤務中・夜勤', () => {
  const s = shift({ startTime: '22:00', endTime: '06:00' });
  assert.equal(shiftPhase(s, { date: '2026-10-26', time: '23:00' }), 'working');
  assert.equal(shiftPhase(s, { date: '2026-10-27', time: '05:59' }), 'working');
  assert.equal(shiftPhase(s, { date: '2026-10-27', time: '06:00' }), 'finished');
  assert.equal(countdownLabel('2026-10-26', { date: '2026-10-26', time: '09:00' }), '本日');
  assert.equal(countdownLabel('2026-10-29', { date: '2026-10-26', time: '09:00' }), 'あと3日');
});

test('今日の予定は時刻順、時間指定なしは最後', () => {
  const now = { date: '2026-10-26', time: '09:00' };
  const tasks: Task[] = [
    { id: 't1', title: '準備', date: '2026-10-26', time: '', status: 'todo', shiftId: '', notes: '', createdAt: 0, updatedAt: 0 },
    { id: 't2', title: '連絡', date: '2026-10-26', time: '08:00', status: 'done', shiftId: '', notes: '', createdAt: 0, updatedAt: 0 },
    { id: 't3', title: '別の日', date: '2026-10-27', time: '08:00', status: 'todo', shiftId: '', notes: '', createdAt: 0, updatedAt: 0 },
  ];
  const items = todayAgenda(now, [shift({ id: 's1' })], tasks, [], new Map());
  assert.deepEqual(items.map((i) => i.key), ['task-t2', 'shift-s1', 'task-t1']);
});

test('期限が近い項目', () => {
  const now = { date: '2026-10-26', time: '12:00' };
  const d = (id: string, date: string, done = false): Deadline => ({
    id, title: id, date, time: '', done, notes: '', createdAt: 0, updatedAt: 0,
  });
  const items = urgentItems(now, [d('far', '2026-11-30'), d('soon', '2026-10-28'), d('done', '2026-10-27', true), d('past', '2026-10-20')], []);
  assert.deepEqual(items.map((i) => i.id), ['past', 'soon']);
  assert.equal(items[0].overdue, true);
});
