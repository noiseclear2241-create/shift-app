'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Icon } from '@/components/Icon';
import { ShiftRow } from '@/components/ShiftRow';
import { useAllData, useNow } from '@/lib/hooks';
import { formatDateJa, parseYmd, sortShifts, venueColor, WEEKDAYS, ymd } from '@/lib/schedule';
import { TASK_STATUS_LABEL } from '@/lib/types';

/** その月のカレンダーに並べる日付（前後の月の日も含めて日曜始まりで6週以内） */
function monthDays(year: number, month: number): string[] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  const last = new Date(year, month + 1, 0);
  const total = Math.ceil((first.getDay() + last.getDate()) / 7) * 7;
  return Array.from({ length: total }, (_, i) => ymd(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)));
}

export default function CalendarPage() {
  const now = useNow();
  const data = useAllData();
  const [cursor, setCursor] = useState<{ y: number; m: number } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  if (!now || data.loading) return <p className="muted">読み込み中…</p>;
  if (data.error) return <p className="error">データを読み込めませんでした：{data.error}</p>;

  const today = parseYmd(now.date);
  const { y, m } = cursor ?? { y: today.getFullYear(), m: today.getMonth() };
  const sel = selected ?? now.date;
  const days = monthDays(y, m);
  const move = (diff: number) => {
    const d = new Date(y, m + diff, 1);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
  };

  const shiftsOn = (date: string) => sortShifts(data.shifts.filter((s) => s.date === date));
  const tasksOn = (date: string) => data.tasks.filter((t) => t.date === date);
  const deadlinesOn = (date: string) => data.deadlines.filter((d) => d.date === date);

  const selShifts = shiftsOn(sel);
  const selTasks = tasksOn(sel).sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
  const selDeadlines = deadlinesOn(sel);

  return (
    <div className="stack">
      <div className="card">
        <div className="cal-head">
          <button className="btn btn-outline btn-sm" onClick={() => move(-1)} aria-label="前の月">
            ‹
          </button>
          <h1>
            {y}年{m + 1}月
          </h1>
          <div className="form-actions" style={{ flexWrap: 'nowrap' }}>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                setCursor(null);
                setSelected(null);
              }}
            >
              今日
            </button>
            <button className="btn btn-outline btn-sm" onClick={() => move(1)} aria-label="次の月">
              ›
            </button>
          </div>
        </div>

        <div className="cal-grid">
          {WEEKDAYS.map((w, i) => (
            <div key={w} className={`cal-dow ${i === 0 ? 'sun' : i === 6 ? 'sat' : ''}`}>
              {w}
            </div>
          ))}
          {days.map((date) => {
            const d = parseYmd(date);
            const shifts = shiftsOn(date).filter((s) => s.status !== 'cancelled');
            const tasks = tasksOn(date);
            const dls = deadlinesOn(date).filter((x) => !x.done);
            return (
              <button
                key={date}
                className={[
                  'cal-cell',
                  d.getMonth() !== m && 'other',
                  date === now.date && 'today',
                  date === sel && 'selected',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => setSelected(date)}
                aria-label={`${formatDateJa(date)} 出勤${shifts.length}件 タスク${tasks.length}件`}
              >
                <span className="cal-num">{d.getDate()}</span>
                {shifts.map((s) => {
                  const venue = data.eventMap.get(s.eventId)?.venue || '会場未設定';
                  const color = venueColor(venue);
                  return (
                    <span
                      key={s.id}
                      className={`cal-chip ${s.status === 'tentative' ? 'tentative' : ''}`}
                      style={s.status === 'tentative' ? { color } : { background: color }}
                    >
                      {venue}
                    </span>
                  );
                })}
                {(tasks.length > 0 || dls.length > 0) && (
                  <span className="cal-marks">
                    {tasks.length > 0 && <span>タスク{tasks.length}</span>}
                    {dls.length > 0 && <span className="dl">期限</span>}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="legend">
          <span>■ 塗りつぶし：確定</span>
          <span>□ 点線：未確定</span>
          <span>色は会場ごと</span>
        </div>
      </div>

      <section className="card">
        <div className="section-head">
          <h2>{formatDateJa(sel)}</h2>
          <Link href={`/shifts/new?date=${sel}`} className="btn btn-outline btn-sm">
            <Icon name="plus" size={16} />
            出勤を登録
          </Link>
        </div>

        {selShifts.length + selTasks.length + selDeadlines.length === 0 ? (
          <p className="empty-msg">この日の予定はありません</p>
        ) : (
          <div className="stack">
            {selShifts.length > 0 && (
              <div className="shift-list">
                {selShifts.map((s) => (
                  <ShiftRow key={s.id} shift={s} event={data.eventMap.get(s.eventId)} />
                ))}
              </div>
            )}
            {selTasks.length > 0 && (
              <ul className="task-list">
                {selTasks.map((t) => (
                  <li key={t.id} className={`task-item ${t.status === 'done' ? 'done' : ''}`}>
                    <span className={`status-pill status-${t.status}`}>{TASK_STATUS_LABEL[t.status]}</span>
                    <div className="grow">
                      <div className="title">{t.title}</div>
                      <div className="small muted">{t.time || '時間指定なし'}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {selDeadlines.length > 0 && (
              <ul className="task-list">
                {selDeadlines.map((d) => (
                  <li key={d.id} className={`task-item ${d.done ? 'done' : ''}`}>
                    <span className={`status-pill ${d.done ? 'status-done' : 'status-todo'}`}>
                      {d.done ? '提出済み' : '期限'}
                    </span>
                    <div className="grow">
                      <div className="title">{d.title}</div>
                      <div className="small muted">{d.time || '時間指定なし'}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/tasks" className="section-link" style={{ marginTop: 0 }}>
              タスク・期限を管理する
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
