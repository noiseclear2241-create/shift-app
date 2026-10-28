import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMorningNotifications, nextMorning, todayIn } from './notifications.ts';
import { DEFAULT_NOTIFICATION_PREFS, type Deadline, type EventItem, type Shift, type Task } from './types.ts';

const base = { createdAt: 0, updatedAt: 0, notes: '' };
const ev: EventItem = { ...base, id: 'e1', name: '物産展', venue: 'A百貨店', facility: '', startDate: '', endDate: '', belongings: '制服' };
const shift = (p: Partial<Shift>): Shift => ({
  ...base, id: 's', eventId: 'e1', date: '2026-10-27', startTime: '10:00', endTime: '19:00', staff: '', role: '', status: 'confirmed', ...p,
});
const deadline = (id: string, date: string, done = false): Deadline => ({ ...base, id, title: id, date, time: '', done });
const task = (id: string, date: string, status: Task['status'] = 'todo'): Task => ({
  ...base, id, title: id, date, time: '', status, shiftId: '',
});

const data = (p: { shifts?: Shift[]; tasks?: Task[]; deadlines?: Deadline[] }) => ({
  shifts: p.shifts ?? [],
  tasks: p.tasks ?? [],
  deadlines: p.deadlines ?? [],
  eventMap: new Map([[ev.id, ev]]),
});

test('提出期限は3日前・前日・当日だけ。提出済みは送らない', () => {
  const list = buildMorningNotifications(
    '2026-10-26',
    data({
      deadlines: [
        deadline('d3', '2026-10-29'),
        deadline('d2', '2026-10-28'),
        deadline('d1', '2026-10-27'),
        deadline('d0', '2026-10-26'),
        deadline('done', '2026-10-27', true),
      ],
    }),
    DEFAULT_NOTIFICATION_PREFS,
  );
  assert.deepEqual(list.map((n) => n.title), ['期限あと3日：d3', '期限明日まで：d1', '期限今日まで：d0']);
});

test('明日の出勤は確定のみ。未確定・キャンセルは送らない', () => {
  const list = buildMorningNotifications(
    '2026-10-26',
    data({
      shifts: [
        shift({ id: 'ok' }),
        shift({ id: 'tentative', status: 'tentative' }),
        shift({ id: 'cancelled', status: 'cancelled' }),
      ],
    }),
    DEFAULT_NOTIFICATION_PREFS,
  );
  assert.equal(list.length, 1);
  assert.equal(list[0].title, '明日は出勤：A百貨店');
  assert.equal(list[0].body, '10月27日(火) 10:00〜19:00／持ち物：制服');
  assert.equal(list[0].url, '/shifts/ok');
});

test('今日の予定のまとめ。予定が無い日は送らない', () => {
  const today = '2026-10-27';
  const list = buildMorningNotifications(
    today,
    data({ shifts: [shift({})], tasks: [task('t1', today), task('t2', today, 'done'), task('old', '2026-10-20')] }),
    DEFAULT_NOTIFICATION_PREFS,
  );
  assert.equal(list.length, 1);
  assert.equal(list[0].body, '出勤 A百貨店 10:00〜19:00／タスク2件（未完了1件）／期限切れのタスク1件');

  assert.equal(buildMorningNotifications(today, data({}), DEFAULT_NOTIFICATION_PREFS).length, 0);
});

test('オフにした種類は送らない', () => {
  const list = buildMorningNotifications(
    '2026-10-26',
    data({ shifts: [shift({})], deadlines: [deadline('d', '2026-10-26')] }),
    { deadline: false, nextShift: true, todayDigest: true },
  );
  assert.deepEqual(list.map((n) => n.kind), ['nextShift']);
});

test('タイムゾーンごとの今日（定時実行は世界標準時22時＝日本時間7時）', () => {
  const at = new Date('2026-10-26T22:30:00Z');
  assert.equal(todayIn('Asia/Tokyo', at), '2026-10-27');
  assert.equal(todayIn('UTC', at), '2026-10-26');
  assert.equal(todayIn('Not/AZone', at), '2026-10-27');
});

test('次の朝の判定', () => {
  assert.equal(nextMorning({ date: '2026-10-26', time: '06:30' }), '2026-10-26');
  assert.equal(nextMorning({ date: '2026-10-26', time: '07:00' }), '2026-10-27');
});
