'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useApp } from '@/components/AppProvider';
import { Icon } from '@/components/Icon';
import { ShiftRow } from '@/components/ShiftRow';
import { useAllData, useNow } from '@/lib/hooks';
import { findNextShift, isMyShift, shiftPhase, sortShifts } from '@/lib/schedule';

type Tab = 'upcoming' | 'past' | 'cancelled';

export default function ShiftsPage() {
  const now = useNow();
  const data = useAllData();
  const { viewer, isManager } = useApp();
  const [tab, setTab] = useState<Tab>('upcoming');
  // チームでは、管理者は全員分、スタッフは自分の分から表示する
  const [scope, setScope] = useState<'mine' | 'all' | null>(null);

  if (!now || data.loading) return <p className="muted">読み込み中…</p>;
  if (data.error) return <p className="error">データを読み込めませんでした：{data.error}</p>;

  const isTeam = !viewer.personal;
  const showAll = isTeam && (scope ?? (isManager ? 'all' : 'mine')) === 'all';
  const myShifts = data.shifts.filter((s) => isMyShift(s, viewer));
  const next = findNextShift(myShifts, now);
  const sorted = sortShifts(showAll ? data.shifts : myShifts);
  const lists: Record<Tab, typeof sorted> = {
    upcoming: sorted.filter((s) => s.status !== 'cancelled' && shiftPhase(s, now) !== 'finished'),
    past: sorted.filter((s) => s.status !== 'cancelled' && shiftPhase(s, now) === 'finished').reverse(),
    cancelled: sorted.filter((s) => s.status === 'cancelled').reverse(),
  };
  const list = lists[tab];
  const openPeriods = data.periods.filter((p) => p.status === 'open').length;

  return (
    <div>
      <div className="page-head">
        <h1>出勤予定</h1>
        {isManager && (
          <Link href="/shifts/new" className="btn btn-primary btn-sm">
            <Icon name="plus" size={18} />
            登録
          </Link>
        )}
      </div>

      {isTeam && (
        <Link href="/availability" className="link-card">
          <span>
            <b>シフト希望</b>
            <span className="small muted">
              {openPeriods > 0 ? ` 受付中 ${openPeriods}件` : ' 受付中のものはありません'}
              {data.pendingAvailability.length > 0 && `・未提出 ${data.pendingAvailability.length}件`}
            </span>
          </span>
          <Icon name="chevron" size={18} />
        </Link>
      )}

      {isTeam && (
        <div className="tabs">
          <button className={!showAll ? 'active' : ''} onClick={() => setScope('mine')}>
            自分の出勤
          </button>
          <button className={showAll ? 'active' : ''} onClick={() => setScope('all')}>
            チーム全員
          </button>
        </div>
      )}

      <div className="tabs">
        {(
          [
            ['upcoming', `今後 ${lists.upcoming.length}`],
            ['past', `終了 ${lists.past.length}`],
            ['cancelled', `キャンセル ${lists.cancelled.length}`],
          ] as [Tab, string][]
        ).map(([t, label]) => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
            {label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="empty-msg">該当する出勤予定はありません</p>
      ) : (
        <div className="shift-list">
          {list.map((s) => (
            <ShiftRow
              key={s.id}
              shift={s}
              event={data.eventMap.get(s.eventId)}
              highlight={s.id === next?.id ? '次の出勤' : undefined}
              showStaff={showAll}
            />
          ))}
        </div>
      )}
    </div>
  );
}
