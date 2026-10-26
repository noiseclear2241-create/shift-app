'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/components/AppProvider';
import { DeadlineForm, TaskForm } from '@/components/forms';
import { Icon } from '@/components/Icon';
import { useAllData, useNow } from '@/lib/hooks';
import { addDays, daysBetween, formatDateJa, nextTaskStatus, upcomingShifts } from '@/lib/schedule';
import { TASK_STATUS_LABEL, type Deadline, type Task } from '@/lib/types';

type Tab = 'tasks' | 'deadlines';

export default function TasksPage() {
  const store = useStore();
  const now = useNow();
  const data = useAllData();
  const [tab, setTab] = useState<Tab>('tasks');
  // null: 閉じている / 'new': 新規 / それ以外: 編集中のID
  const [editing, setEditing] = useState<string | null>(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('tab') === 'deadlines') setTab('deadlines');
  }, []);

  if (!now || data.loading) return <p className="muted">読み込み中…</p>;
  if (data.error) return <p className="error">データを読み込めませんでした：{data.error}</p>;

  const switchTab = (t: Tab) => {
    setTab(t);
    setEditing(null);
  };

  const shiftLabel = (t: Task) => {
    const s = data.shifts.find((x) => x.id === t.shiftId);
    if (!s) return '';
    return `${formatDateJa(s.date)} ${data.eventMap.get(s.eventId)?.venue || '会場未設定'} の準備`;
  };

  const removeTask = async (t: Task) => {
    if (confirm(`「${t.title}」を削除しますか？`)) await store.remove('tasks', t.id);
  };
  const removeDeadline = async (d: Deadline) => {
    if (confirm(`「${d.title}」を削除しますか？`)) await store.remove('deadlines', d.id);
  };

  // ---- タスク：期限切れ / 今日 / 明日以降 / 日付なし / 完了 に分ける
  const tomorrow = addDays(now.date, 1);
  const byWhen = (a: Task, b: Task) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`);
  const open = data.tasks.filter((t) => t.status !== 'done').sort(byWhen);
  const groups: [string, Task[], boolean?][] = [
    ['期限切れ', open.filter((t) => t.date && t.date < now.date), true],
    ['今日', open.filter((t) => t.date === now.date)],
    ['明日以降', open.filter((t) => t.date && t.date >= tomorrow)],
    ['日付なし', open.filter((t) => !t.date)],
    ['完了', data.tasks.filter((t) => t.status === 'done').sort(byWhen).reverse()],
  ];

  const editingTask = editing && editing !== 'new' ? data.tasks.find((t) => t.id === editing) : undefined;
  const editingDeadline = editing && editing !== 'new' ? data.deadlines.find((d) => d.id === editing) : undefined;

  return (
    <div>
      <div className="page-head">
        <h1>タスク・期限</h1>
        {!editing && (
          <button className="btn btn-primary btn-sm" onClick={() => setEditing('new')}>
            <Icon name="plus" size={18} />
            追加
          </button>
        )}
      </div>

      <div className="tabs">
        <button className={tab === 'tasks' ? 'active' : ''} onClick={() => switchTab('tasks')}>
          タスク
        </button>
        <button className={tab === 'deadlines' ? 'active' : ''} onClick={() => switchTab('deadlines')}>
          提出期限
        </button>
      </div>

      {editing && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h2 style={{ marginBottom: 12 }}>
            {editing === 'new' ? '追加' : '編集'}：{tab === 'tasks' ? 'タスク' : '提出期限'}
          </h2>
          {tab === 'tasks' ? (
            <TaskForm
              key={editing}
              initial={editingTask}
              shiftOptions={[
                // 編集中のタスクが終了済みの出勤に紐づいていても選択肢から消えないようにする
                ...data.shifts.filter((s) => s.id === editingTask?.shiftId && !upcomingShifts([s], now).length),
                ...upcomingShifts(data.shifts, now),
              ]}
              eventMap={data.eventMap}
              onSaved={() => setEditing(null)}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <DeadlineForm
              key={editing}
              initial={editingDeadline}
              onSaved={() => setEditing(null)}
              onCancel={() => setEditing(null)}
            />
          )}
        </div>
      )}

      {tab === 'tasks' ? (
        data.tasks.length === 0 ? (
          <p className="empty-msg">タスクはまだありません</p>
        ) : (
          <div className="stack">
            {groups.map(([label, list, overdue]) =>
              list.length === 0 ? null : (
                <section key={label} className="task-group">
                  <h3 className={overdue ? 'overdue' : ''}>
                    {label}（{list.length}）
                  </h3>
                  <ul className="task-list">
                    {list.map((t) => (
                      <li key={t.id} className={`task-item ${t.status === 'done' ? 'done' : ''}`}>
                        <button
                          className={`status-btn status-${t.status}`}
                          onClick={() => store.update('tasks', t.id, { status: nextTaskStatus(t.status) })}
                        >
                          {TASK_STATUS_LABEL[t.status]}
                        </button>
                        <div className="grow">
                          <div className="title">{t.title}</div>
                          <div className="small muted">
                            {[t.date && `${formatDateJa(t.date)} ${t.time}`.trim(), shiftLabel(t)].filter(Boolean).join(' ・ ')}
                          </div>
                        </div>
                        <div className="form-actions" style={{ flexDirection: 'column' }}>
                          <button className="btn-link small" onClick={() => setEditing(t.id)}>
                            編集
                          </button>
                          <button className="btn-link small" style={{ color: 'var(--danger)' }} onClick={() => removeTask(t)}>
                            削除
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ),
            )}
          </div>
        )
      ) : data.deadlines.length === 0 ? (
        <p className="empty-msg">登録された提出期限はありません</p>
      ) : (
        <ul className="task-list">
          {[...data.deadlines]
            .sort((a, b) => Number(a.done) - Number(b.done) || `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
            .map((d) => {
              const left = daysBetween(now.date, d.date);
              return (
                <li key={d.id} className={`task-item ${d.done ? 'done' : ''}`}>
                  <button
                    className={`status-btn ${d.done ? 'status-done' : 'status-todo'}`}
                    onClick={() => store.update('deadlines', d.id, { done: !d.done })}
                  >
                    {d.done ? '提出済み' : '未提出'}
                  </button>
                  <div className="grow">
                    <div className="title">{d.title}</div>
                    <div className="small muted">
                      {formatDateJa(d.date)} {d.time}
                      {!d.done && (
                        <b style={{ marginLeft: 8, color: left < 0 ? 'var(--danger)' : left <= 3 ? 'var(--warn)' : undefined }}>
                          {left < 0 ? '期限切れ' : left === 0 ? '今日まで' : `あと${left}日`}
                        </b>
                      )}
                    </div>
                    {d.notes && <div className="small muted">{d.notes}</div>}
                  </div>
                  <div className="form-actions" style={{ flexDirection: 'column' }}>
                    <button className="btn-link small" onClick={() => setEditing(d.id)}>
                      編集
                    </button>
                    <button className="btn-link small" style={{ color: 'var(--danger)' }} onClick={() => removeDeadline(d)}>
                      削除
                    </button>
                  </div>
                </li>
              );
            })}
        </ul>
      )}
    </div>
  );
}
