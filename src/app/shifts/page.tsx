'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Icon } from '@/components/Icon';
import { ShiftRow } from '@/components/ShiftRow';
import { useAllData, useNow } from '@/lib/hooks';
import { findNextShift, shiftPhase, sortShifts } from '@/lib/schedule';

type Tab = 'upcoming' | 'past' | 'cancelled';

export default function ShiftsPage() {
  const now = useNow();
  const data = useAllData();
  const [tab, setTab] = useState<Tab>('upcoming');

  if (!now || data.loading) return <p className="muted">読み込み中…</p>;
  if (data.error) return <p className="error">データを読み込めませんでした：{data.error}</p>;

  const next = findNextShift(data.shifts, now);
  const sorted = sortShifts(data.shifts);
  const lists: Record<Tab, typeof sorted> = {
    upcoming: sorted.filter((s) => s.status !== 'cancelled' && shiftPhase(s, now) !== 'finished'),
    past: sorted.filter((s) => s.status !== 'cancelled' && shiftPhase(s, now) === 'finished').reverse(),
    cancelled: sorted.filter((s) => s.status === 'cancelled').reverse(),
  };
  const list = lists[tab];

  return (
    <div>
      <div className="page-head">
        <h1>出勤予定</h1>
        <Link href="/shifts/new" className="btn btn-primary btn-sm">
          <Icon name="plus" size={18} />
          登録
        </Link>
      </div>

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
            />
          ))}
        </div>
      )}
    </div>
  );
}
