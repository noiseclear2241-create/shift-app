'use client';

import Link from 'next/link';
import { useStore } from '@/components/AppProvider';
import { Icon } from '@/components/Icon';
import { NextShiftCard } from '@/components/NextShiftCard';
import { ShiftRow } from '@/components/ShiftRow';
import { useAllData, useNow } from '@/lib/hooks';
import {
  findNextShift,
  formatDateJa,
  nextAgendaItem,
  nextTaskStatus,
  parseYmd,
  todayAgenda,
  upcomingShifts,
  urgentItems,
  type AgendaItem,
} from '@/lib/schedule';
import { TASK_STATUS_LABEL, type Task } from '@/lib/types';

const AGENDA_STATUS_LABEL = { done: '完了', doing: '進行中', todo: '未完了' } as const;
const SHIFT_PHASE_LABEL = { done: '終了', doing: '勤務中', todo: 'これから' } as const;

export default function DashboardPage() {
  const now = useNow();
  const data = useAllData();
  const store = useStore();

  if (!now || data.loading) return <p className="muted">読み込み中…</p>;
  if (data.error) return <p className="error">データを読み込めませんでした：{data.error}</p>;

  const next = findNextShift(data.shifts, now);
  const upcoming = upcomingShifts(data.shifts, now);
  const agenda = todayAgenda(now, data.shifts, data.tasks, data.deadlines, data.eventMap);
  const nextItem = nextAgendaItem(agenda, now);
  const urgent = urgentItems(now, data.deadlines, data.tasks);
  const prepTasks = next ? data.tasks.filter((t) => t.shiftId === next.id) : [];
  const todayTasks = agenda.filter((i) => i.kind === 'task');
  const doneCount = todayTasks.filter((i) => i.status === 'done').length;
  const todayShifts = data.shifts.filter((s) => s.date === now.date && s.status !== 'cancelled');

  const toggleTask = (t: Pick<Task, 'id' | 'status'>) =>
    store.update('tasks', t.id, { status: nextTaskStatus(t.status) });

  const toggleAgenda = (item: AgendaItem) => {
    if (item.kind === 'task') toggleTask({ id: item.id, status: item.status });
    if (item.kind === 'deadline') store.update('deadlines', item.id, { done: item.status !== 'done' });
  };

  const today = parseYmd(now.date);

  return (
    <div className="dash">
      <header className="date-head">
        <div className="small muted">{today.getFullYear()}年</div>
        <h1 className="date-big">{formatDateJa(now.date)}</h1>
        <div className="today-work">
          {todayShifts.length > 0
            ? `今日は出勤日です（${todayShifts.map((s) => data.eventMap.get(s.eventId)?.venue || '会場未設定').join('・')}）`
            : '今日の出勤予定はありません'}
        </div>
        {agenda.length > 0 && (
          <a href="#today" className="today-jump">
            今日の予定 {agenda.length}件（未完了 {agenda.filter((i) => i.status !== 'done').length}）を見る
          </a>
        )}
      </header>

      {urgent.length > 0 && (
        <section className="urgent">
          <div className="urgent-title">
            <Icon name="alert" size={18} />
            期限が近い・過ぎている項目
          </div>
          <ul>
            {urgent.map((u) => (
              <li key={u.key} className={u.overdue ? 'overdue' : ''}>
                <span className="urgent-when">
                  {u.overdue ? '期限切れ' : u.daysLeft === 0 ? '今日まで' : `あと${u.daysLeft}日`}
                </span>
                <Link href={`/tasks?tab=${u.kind === 'deadline' ? 'deadlines' : 'tasks'}`}>{u.title}</Link>
                <span className="small muted">
                  {formatDateJa(u.date)}
                  {u.time && ` ${u.time}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="dash-grid">
        <div className="col-main">
          <NextShiftCard
            shift={next}
            event={next ? data.eventMap.get(next.eventId) : undefined}
            prepTasks={prepTasks}
            tentativeCount={upcoming.filter((s) => s.status === 'tentative').length}
            now={now}
            onToggleTask={toggleTask}
          />

          <section className="card" id="today">
            <div className="section-head">
              <h2>今日の予定</h2>
              <div className="counts">
                <span>
                  完了 <b>{doneCount}</b>
                </span>
                <span>
                  未完了 <b>{todayTasks.length - doneCount}</b>
                </span>
              </div>
            </div>

            {agenda.length === 0 ? (
              <p className="empty-msg">今日の予定はありません</p>
            ) : (
              <ul className="agenda">
                {agenda.map((item) => (
                  <li
                    key={item.key}
                    className={`agenda-item is-${item.status} ${nextItem?.key === item.key ? 'is-next' : ''}`}
                  >
                    <div className="agenda-time">{item.time || '時刻なし'}</div>
                    <div className="agenda-body">
                      {nextItem?.key === item.key && <div className="next-tag">次の予定</div>}
                      <div className="agenda-title">
                        {item.kind === 'shift' ? (
                          <Link href={`/shifts/${item.id}`}>{item.title}</Link>
                        ) : (
                          item.title
                        )}
                        {item.tentative && <span className="badge badge-tentative">未確定</span>}
                      </div>
                      {item.detail && <div className="small muted">{item.detail}</div>}
                    </div>
                    {item.kind === 'shift' ? (
                      <span className={`status-pill status-${item.status}`}>{SHIFT_PHASE_LABEL[item.status]}</span>
                    ) : (
                      <button
                        className={`status-btn status-${item.status}`}
                        onClick={() => toggleAgenda(item)}
                        aria-label={`状態を変更（今：${AGENDA_STATUS_LABEL[item.status]}）`}
                      >
                        {item.kind === 'task' ? TASK_STATUS_LABEL[item.status] : item.status === 'done' ? '提出済み' : '未提出'}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <Link href="/tasks" className="section-link">
              タスクを追加・管理する
              <Icon name="chevron" size={16} />
            </Link>
          </section>
        </div>

        <div className="col-side">
          <section className="card">
            <div className="section-head">
              <h2>今後の出勤</h2>
              <span className="small muted">{upcoming.length}件</span>
            </div>
            {upcoming.length === 0 ? (
              <p className="empty-msg">今後の出勤予定はありません</p>
            ) : (
              <div className="shift-list">
                {upcoming.slice(0, 8).map((s) => (
                  <ShiftRow
                    key={s.id}
                    shift={s}
                    event={data.eventMap.get(s.eventId)}
                    highlight={s.id === next?.id ? '次の出勤' : undefined}
                  />
                ))}
              </div>
            )}
            <Link href="/shifts" className="section-link">
              すべての出勤を見る
              <Icon name="chevron" size={16} />
            </Link>
          </section>

          <nav className="quick-links">
            <Link href="/calendar" className="quick">
              <Icon name="calendar" />
              カレンダー
            </Link>
            <Link href="/tasks" className="quick">
              <Icon name="check" />
              タスク
            </Link>
            <Link href="/shifts/new" className="quick">
              <Icon name="plus" />
              出勤を登録
            </Link>
          </nav>
        </div>
      </div>
    </div>
  );
}
