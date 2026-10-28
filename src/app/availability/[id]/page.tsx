'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useApp, useStore } from '@/components/AppProvider';
import { useAllData, useCollection, useNow } from '@/lib/hooks';
import { datesInRange, daysBetween, formatDateJa, formatPeriod, parseYmd, WEEKDAYS } from '@/lib/schedule';
import {
  AVAILABILITY_LABEL,
  type Availability,
  type AvailabilityMark,
  type AvailabilityPeriod,
} from '@/lib/types';

const MARKS: AvailabilityMark[] = ['ok', 'maybe', 'ng'];

export default function AvailabilityDetailPage({ params }: { params: { id: string } }) {
  const { uid, userName, workspace, isManager } = useApp();
  const store = useStore();
  const now = useNow();
  const data = useAllData();
  const [days, setDays] = useState<Record<string, AvailabilityMark> | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const period = data.periods.find((p) => p.id === params.id);
  const mine = data.myAvailability.find((a) => a.periodId === params.id);

  // 提出済みの内容を、入力欄の初期値にする（読み込みが終わってから1回だけ）
  useEffect(() => {
    if (data.loading || days !== null) return;
    setDays(mine?.days ?? {});
    setNote(mine?.note ?? '');
  }, [data.loading, mine, days]);

  if (!now || data.loading || days === null) return <p className="muted">読み込み中…</p>;
  if (data.error) return <p className="error">データを読み込めませんでした：{data.error}</p>;
  if (!period) {
    return (
      <div className="card stack">
        <p style={{ margin: 0 }}>このシフト希望の受付は見つかりませんでした（削除された可能性があります）。</p>
        <Link href="/availability" className="btn btn-outline">
          一覧へ
        </Link>
      </div>
    );
  }

  const dates = datesInRange(period.startDate, period.endDate);
  const open = period.status === 'open';
  const left = period.deadlineDate ? daysBetween(now.date, period.deadlineDate) : null;
  const answered = dates.filter((d) => days[d]).length;

  // 同じ印をもう一度押すと取り消し
  const mark = (date: string, m: AvailabilityMark) => {
    const next = { ...days };
    if (next[date] === m) delete next[date];
    else next[date] = m;
    setDays(next);
  };
  const markAll = (m: AvailabilityMark) => setDays(Object.fromEntries(dates.map((d) => [d, m])));

  const submit = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const clean = Object.fromEntries(Object.entries(days).filter(([d, m]) => m && dates.includes(d)));
      await store.set('availability', `${period.id}_${uid}`, {
        periodId: period.id,
        uid,
        name: workspace?.memberNames?.[uid] || userName,
        days: clean,
        note: note.trim().slice(0, 500),
        submittedAt: Date.now(),
      });
      setMessage({ ok: true, text: mine ? '修正して提出しました。' : '提出しました。締め切りまでは修正できます。' });
    } catch (e) {
      setMessage({ ok: false, text: `提出できませんでした：${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <Link href="/availability" className="btn-link">
          ‹ シフト希望
        </Link>
      </div>

      <section className="card stack">
        <div>
          <h1 style={{ fontSize: '1.4rem' }}>
            {period.title}
            <span className={`badge ${open ? 'badge-confirmed' : 'badge-cancelled'}`}>{open ? '受付中' : '締め切り'}</span>
          </h1>
          <div className="small muted">期間 {formatPeriod(period.startDate, period.endDate)}</div>
          {period.deadlineDate && (
            <div className="small" style={{ fontWeight: 700, color: left !== null && left <= 1 ? 'var(--danger)' : undefined }}>
              提出期限 {formatDateJa(period.deadlineDate)}
              {period.deadlineTime && ` ${period.deadlineTime}`}
              {open && left !== null && (left < 0 ? '（期限切れ）' : left === 0 ? '（今日まで）' : `（あと${left}日）`)}
            </div>
          )}
          {period.notes && <p className="small" style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>{period.notes}</p>}
        </div>
      </section>

      <section className="card stack">
        <div className="section-head" style={{ marginBottom: 0 }}>
          <h2>あなたの希望</h2>
          <span className="small muted">
            {mine?.submittedAt ? '提出済み' : '未提出'}・{answered}/{dates.length}日
          </span>
        </div>
        {open ? (
          <>
            <p className="small muted" style={{ margin: 0 }}>
              ○出られる　△相談したい　×出られない（もう一度押すと取り消し）
            </p>
            <div className="form-actions">
              <button className="btn btn-outline btn-sm" onClick={() => markAll('ok')}>
                すべて○
              </button>
              <button className="btn btn-outline btn-sm" onClick={() => markAll('ng')}>
                すべて×
              </button>
            </div>
          </>
        ) : (
          <p className="small muted" style={{ margin: 0 }}>
            締め切られたため、変更できません。
          </p>
        )}

        <ul className="avail-list">
          {dates.map((d) => {
            const dow = parseYmd(d).getDay();
            return (
              <li key={d}>
                <span className={`avail-date ${dow === 0 ? 'sun' : dow === 6 ? 'sat' : ''}`}>
                  {Number(d.slice(5, 7))}/{Number(d.slice(8, 10))}({WEEKDAYS[dow]})
                </span>
                <span className="avail-marks" role="radiogroup" aria-label={`${formatDateJa(d)}の希望`}>
                  {MARKS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={days[d] === m}
                      disabled={!open}
                      className={`mark mark-${m} ${days[d] === m ? 'active' : ''}`}
                      onClick={() => mark(d, m)}
                    >
                      {AVAILABILITY_LABEL[m]}
                    </button>
                  ))}
                </span>
              </li>
            );
          })}
        </ul>

        {open && (
          <>
            <label className="form" style={{ gap: 4 }}>
              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>ひとこと（任意）</span>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="例：15日は午後からなら出られます" />
            </label>
            <button className="btn btn-primary" disabled={busy} onClick={submit}>
              {busy ? '提出中…' : mine?.submittedAt ? '修正して提出する' : '提出する'}
            </button>
          </>
        )}
        {message && (
          <p className={message.ok ? 'ok-msg' : 'error'} style={{ margin: 0 }} aria-live="polite">
            {message.text}
          </p>
        )}
      </section>

      {isManager && <ManagerSummary period={period} dates={dates} />}
    </div>
  );
}

/** 管理者だけ：全員の回答の集計と、締め切り・削除 */
function ManagerSummary({ period, dates }: { period: AvailabilityPeriod; dates: string[] }) {
  const { workspace } = useApp();
  const store = useStore();
  const router = useRouter();
  const answers = useCollection<Availability>('availability', { field: 'periodId', value: period.id });
  const [busy, setBusy] = useState(false);

  if (answers.loading) return <p className="muted">集計を読み込み中…</p>;
  if (answers.error) return <p className="error">集計を読み込めませんでした：{answers.error}</p>;

  const submitted = answers.items.filter((a) => a.submittedAt);
  const submittedUids = new Set(submitted.map((a) => a.uid));
  const members = Object.keys(workspace?.members ?? {});
  const notYet = members.filter((m) => !submittedUids.has(m)).map((m) => workspace?.memberNames?.[m] || 'メンバー');

  const toggleStatus = async () => {
    setBusy(true);
    await store.update('availabilityPeriods', period.id, { status: period.status === 'open' ? 'closed' : 'open' });
    setBusy(false);
  };
  const remove = async () => {
    if (!confirm(`「${period.title}」の受付と、提出された希望をすべて削除しますか？（元に戻せません）`)) return;
    setBusy(true);
    await Promise.all(answers.items.map((a) => store.remove('availability', a.id)));
    await store.remove('availabilityPeriods', period.id);
    router.replace('/availability');
  };

  return (
    <section className="card stack">
      <div className="section-head" style={{ marginBottom: 0 }}>
        <h2>みんなの希望（管理者だけに表示）</h2>
        <span className="small muted">
          提出 {submitted.length}/{members.length}人
        </span>
      </div>
      {notYet.length > 0 && <p className="small" style={{ margin: 0 }}>未提出：{notYet.join('、')}</p>}

      {submitted.length === 0 ? (
        <p className="empty-msg">まだ誰も提出していません</p>
      ) : (
        <ul className="avail-summary">
          {dates.map((d) => {
            const by = (m: AvailabilityMark) => submitted.filter((a) => a.days?.[d] === m).map((a) => a.name);
            const ok = by('ok');
            const maybe = by('maybe');
            const ng = by('ng');
            return (
              <li key={d}>
                <div className="avail-summary-head">
                  <b>{formatDateJa(d)}</b>
                  <span className="small">
                    ○{ok.length}　△{maybe.length}　×{ng.length}
                  </span>
                </div>
                {(ok.length > 0 || maybe.length > 0) && (
                  <div className="small muted">
                    {ok.length > 0 && `○ ${ok.join('、')}`}
                    {ok.length > 0 && maybe.length > 0 && '　'}
                    {maybe.length > 0 && `△ ${maybe.join('、')}`}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {submitted.some((a) => a.note) && (
        <div className="notice-box">
          <b>ひとこと</b>
          {submitted
            .filter((a) => a.note)
            .map((a) => (
              <p key={a.id} className="small" style={{ margin: '4px 0 0' }}>
                {a.name}：{a.note}
              </p>
            ))}
        </div>
      )}

      <div className="form-actions">
        <button className="btn btn-outline" disabled={busy} onClick={toggleStatus}>
          {period.status === 'open' ? '受付を締め切る' : '受付を再開する'}
        </button>
        <button className="btn btn-danger" disabled={busy} onClick={remove}>
          削除
        </button>
      </div>
    </section>
  );
}
