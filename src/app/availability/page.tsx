'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useApp, useStore } from '@/components/AppProvider';
import { Icon } from '@/components/Icon';
import { useAllData, useNow } from '@/lib/hooks';
import { daysBetween, formatDateJa, formatPeriod, ymd } from '@/lib/schedule';

/** シフト希望の受付の一覧。管理者は新しい受付を作れる */
export default function AvailabilityListPage() {
  const { viewer, isManager } = useApp();
  const store = useStore();
  const router = useRouter();
  const now = useNow();
  const data = useAllData();
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [f, setF] = useState({ title: '', startDate: '', endDate: '', deadlineDate: '', deadlineTime: '', notes: '' });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  if (!now || data.loading) return <p className="muted">読み込み中…</p>;
  if (data.error) return <p className="error">データを読み込めませんでした：{data.error}</p>;
  if (viewer.personal) {
    return (
      <div className="card stack">
        <h1>シフト希望</h1>
        <p style={{ margin: 0 }}>シフト希望の受付は、チームで使う機能です。</p>
        <Link href="/team" className="btn btn-outline">
          チーム画面へ
        </Link>
      </div>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (daysBetween(f.startDate, f.endDate) < 0) return setError('終了日は開始日より後にしてください');
    if (daysBetween(f.startDate, f.endDate) > 61) return setError('一度に受け付けられるのは62日分までです');
    setBusy(true);
    setError('');
    try {
      const id = await store.add('availabilityPeriods', { ...f, status: 'open' });
      setCreating(false);
      setF({ title: '', startDate: '', endDate: '', deadlineDate: '', deadlineTime: '', notes: '' });
      router.push(`/availability/${id}`);
    } catch (err) {
      setError(`保存できませんでした：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  // 来月1日〜末日を初期値にする（よくある「〇月分」の受付）
  const startCreate = () => {
    const [y, m] = now.date.split('-').map(Number); // m は 1〜12
    const first = new Date(y, m, 1); // 来月1日
    const last = new Date(y, m + 1, 0); // 来月末日
    setF({ ...f, title: `${first.getMonth() + 1}月分`, startDate: ymd(first), endDate: ymd(last) });
    setCreating(true);
  };

  const submitted = new Set(data.myAvailability.filter((a) => a.submittedAt).map((a) => a.periodId));
  const periods = [...data.periods].sort(
    (a, b) => (a.status === b.status ? 0 : a.status === 'open' ? -1 : 1) || b.startDate.localeCompare(a.startDate),
  );

  return (
    <div className="stack">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <h1>シフト希望</h1>
        {isManager && !creating && (
          <button className="btn btn-primary btn-sm" onClick={startCreate}>
            <Icon name="plus" size={18} />
            受付を作る
          </button>
        )}
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        {isManager
          ? '期間と提出期限を決めて受付を作ると、メンバーが出られる日（○△×）を提出できます。未提出の人には、期限の3日前・前日・当日の朝に通知が届きます。'
          : '受付中の期間について、出られる日（○△×）を提出してください。'}
      </p>

      {creating && (
        <section className="card">
          <h2 style={{ marginBottom: 12 }}>シフト希望の受付を作る</h2>
          <form className="form" onSubmit={submit}>
            <label>
              名前
              <input required value={f.title} onChange={set('title')} maxLength={40} placeholder="例：12月分" />
            </label>
            <div className="row">
              <label>
                希望を聞く期間（初日）
                <input type="date" required value={f.startDate} onChange={set('startDate')} />
              </label>
              <label>
                （最終日）
                <input type="date" required value={f.endDate} min={f.startDate || undefined} onChange={set('endDate')} />
              </label>
            </div>
            <div className="row">
              <label>
                提出期限
                <input type="date" required value={f.deadlineDate} onChange={set('deadlineDate')} />
              </label>
              <label>
                時刻
                <input type="time" value={f.deadlineTime} onChange={set('deadlineTime')} />
              </label>
            </div>
            <label>
              メンバーへの連絡
              <textarea value={f.notes} onChange={set('notes')} placeholder="例：土日に出られる人を特に募集しています" />
            </label>
            {error && <p className="error">{error}</p>}
            <div className="form-actions">
              <button type="button" className="btn btn-outline" onClick={() => setCreating(false)}>
                キャンセル
              </button>
              <button className="btn btn-primary" disabled={busy}>
                {busy ? '作成中…' : '受付を作る'}
              </button>
            </div>
          </form>
        </section>
      )}

      {periods.length === 0 ? (
        <p className="empty-msg">シフト希望の受付はまだありません</p>
      ) : (
        <ul className="task-list">
          {periods.map((p) => {
            const left = p.deadlineDate ? daysBetween(now.date, p.deadlineDate) : null;
            const done = submitted.has(p.id);
            return (
              <li key={p.id}>
                <Link href={`/availability/${p.id}`} className="task-item">
                  <div className="grow">
                    <div className="title">
                      {p.title}
                      <span className={`badge ${p.status === 'open' ? 'badge-confirmed' : 'badge-cancelled'}`}>
                        {p.status === 'open' ? '受付中' : '締め切り'}
                      </span>
                    </div>
                    <div className="small muted">
                      期間 {formatPeriod(p.startDate, p.endDate)}
                      {p.deadlineDate && ` ・ 期限 ${formatDateJa(p.deadlineDate)}${p.deadlineTime ? ` ${p.deadlineTime}` : ''}`}
                    </div>
                  </div>
                  <span className={`status-pill ${done ? 'status-done' : 'status-todo'}`}>
                    {done ? '提出済み' : p.status === 'open' ? (left !== null && left < 0 ? '期限切れ' : '未提出') : '未提出'}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
