'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useApp, useStore } from '@/components/AppProvider';
import { ShiftForm, TaskForm } from '@/components/forms';
import { ShiftStatusBadge } from '@/components/ShiftRow';
import { useAllData, useNow } from '@/lib/hooks';
import {
  countdownLabel,
  findNextShift,
  formatDateJa,
  formatPeriod,
  formatTimeRange,
  isMyShift,
  isMyTask,
  nextTaskStatus,
  shiftPhase,
} from '@/lib/schedule';
import { SHIFT_STATUS_LABEL, TASK_STATUS_LABEL, type ShiftStatus } from '@/lib/types';

export default function ShiftDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const store = useStore();
  const { viewer, isManager, workspace } = useApp();
  const now = useNow();
  const data = useAllData();
  const [editing, setEditing] = useState(false);
  const [addingTask, setAddingTask] = useState(false);

  if (!now || data.loading) return <p className="muted">読み込み中…</p>;
  if (data.error) return <p className="error">データを読み込めませんでした：{data.error}</p>;

  const shift = data.shifts.find((s) => s.id === params.id);
  if (!shift) {
    return (
      <div className="card">
        <p>この出勤予定は見つかりませんでした（削除された可能性があります）。</p>
        <Link href="/shifts" className="btn btn-outline">
          出勤一覧へ
        </Link>
      </div>
    );
  }

  const event = data.eventMap.get(shift.eventId);
  const phase = shiftPhase(shift, now);
  const isNext = findNextShift(data.shifts.filter((s) => isMyShift(s, viewer)), now)?.id === shift.id;
  // 準備タスク：スタッフは自分の分、管理者は全員分を見る
  const prepTasks = data.tasks.filter((t) => t.shiftId === shift.id && (isManager || isMyTask(t, viewer)));
  const assigneeLabel =
    shift.staff ||
    (shift.assigneeUid ? workspace?.memberNames?.[shift.assigneeUid] : '') ||
    (viewer.personal ? '' : '未定');

  const setStatus = (status: ShiftStatus) => store.update('shifts', shift.id, { status });

  const remove = async () => {
    if (!confirm('この出勤予定を削除しますか？\n（予定が無くなった場合は「キャンセル」にすると記録が残ります）')) return;
    // 紐づいた準備タスクは消さずに、紐づけだけ外す
    await Promise.all(prepTasks.map((t) => store.update('tasks', t.id, { shiftId: '' })));
    await store.remove('shifts', shift.id);
    router.replace('/shifts');
  };

  if (editing) {
    return (
      <div>
        <div className="page-head">
          <h1>出勤予定を編集</h1>
        </div>
        <div className="card">
          <ShiftForm initial={shift} events={data.events} onSaved={() => setEditing(false)} onCancel={() => setEditing(false)} />
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <Link href="/shifts" className="btn-link">
          ‹ 出勤一覧
        </Link>
        {isManager && (
          <button className="btn btn-outline btn-sm" onClick={() => setEditing(true)}>
            編集
          </button>
        )}
      </div>

      <section className="card stack">
        <div>
          <div className="small muted">
            {isNext && <span className="badge badge-next" style={{ marginLeft: 0, marginRight: 6 }}>次の出勤</span>}
            {phase === 'finished' ? '終了' : phase === 'working' ? '勤務中' : countdownLabel(shift.date, now)}
            <ShiftStatusBadge status={shift.status} />
          </div>
          <h1 className="next-date">{formatDateJa(shift.date, true)}</h1>
          <div className="next-venue">{event?.venue || '会場未設定'}</div>
        </div>

        <dl className="detail-list">
          <div>
            <dt>勤務時間</dt>
            <dd>{formatTimeRange(shift.startTime, shift.endTime)}</dd>
          </div>
          <div>
            <dt>催事名</dt>
            <dd>{event?.name || '—'}</dd>
          </div>
          <div>
            <dt>施設・売場</dt>
            <dd>{event?.facility || '—'}</dd>
          </div>
          <div>
            <dt>開催期間</dt>
            <dd>{event?.startDate ? formatPeriod(event.startDate, event.endDate) : '—'}</dd>
          </div>
          <div>
            <dt>担当</dt>
            <dd>{assigneeLabel || '—'}</dd>
          </div>
          <div>
            <dt>役割</dt>
            <dd>{shift.role || '—'}</dd>
          </div>
          <div>
            <dt>持ち物・準備</dt>
            <dd>{event?.belongings || '—'}</dd>
          </div>
          <div>
            <dt>連絡事項</dt>
            <dd>{[event?.notes, shift.notes].filter(Boolean).join('\n') || '—'}</dd>
          </div>
        </dl>

        {isManager && (
          <div>
            <div className="small muted" style={{ marginBottom: 6 }}>
              状態を変更
            </div>
            <div className="choice">
              {(Object.entries(SHIFT_STATUS_LABEL) as [ShiftStatus, string][]).map(([s, label]) => (
                <button key={s} className={shift.status === s ? 'active' : ''} onClick={() => setStatus(s)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {event && isManager && (
          <Link href={`/events?edit=${event.id}`} className="section-link" style={{ marginTop: 0 }}>
            催事の情報（会場・持ち物など）を編集
          </Link>
        )}
      </section>

      <section className="card">
        <div className="section-head">
          <h2>準備タスク</h2>
          {!addingTask && (
            <button className="btn btn-outline btn-sm" onClick={() => setAddingTask(true)}>
              追加
            </button>
          )}
        </div>
        {addingTask && (
          <div style={{ marginBottom: 12 }}>
            <TaskForm
              shiftOptions={[]}
              eventMap={data.eventMap}
              fixedShiftId={shift.id}
              onSaved={() => setAddingTask(false)}
              onCancel={() => setAddingTask(false)}
            />
          </div>
        )}
        {prepTasks.length === 0 ? (
          !addingTask && <p className="empty-msg">この出勤に紐づくタスクはありません</p>
        ) : (
          <ul className="task-list">
            {prepTasks.map((t) => (
              <li key={t.id} className={`task-item ${t.status === 'done' ? 'done' : ''}`}>
                {isManager || isMyTask(t, viewer) ? (
                  <button
                    className={`status-btn status-${t.status}`}
                    onClick={() => store.update('tasks', t.id, { status: nextTaskStatus(t.status) })}
                  >
                    {TASK_STATUS_LABEL[t.status]}
                  </button>
                ) : (
                  <span className={`status-pill status-${t.status}`}>{TASK_STATUS_LABEL[t.status]}</span>
                )}
                <div className="grow">
                  <div className="title">
                    {t.title}
                    {!viewer.personal && t.assigneeUid && t.assigneeUid !== viewer.uid && (
                      <span className="staff-name">{workspace?.memberNames?.[t.assigneeUid] || 'メンバー'}</span>
                    )}
                  </div>
                  {t.date && (
                    <div className="small muted">
                      {formatDateJa(t.date)} {t.time}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {isManager && (
        <button className="btn btn-danger" onClick={remove}>
          この出勤予定を削除
        </button>
      )}
    </div>
  );
}
