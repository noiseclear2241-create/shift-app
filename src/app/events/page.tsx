'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/components/AppProvider';
import { EventForm } from '@/components/forms';
import { Icon } from '@/components/Icon';
import { useAllData, useNow } from '@/lib/hooks';
import { formatPeriod, venueColor } from '@/lib/schedule';
import type { EventItem } from '@/lib/types';

export default function EventsPage() {
  const store = useStore();
  const now = useNow();
  const data = useAllData();
  // null: 一覧表示 / 'new': 新規 / それ以外: 編集中の催事ID
  const [editing, setEditing] = useState<string | null>(null);

  // 出勤詳細の「催事の情報を編集」から ?edit=ID で来たとき
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('edit');
    if (id) setEditing(id);
  }, []);

  if (!now || data.loading) return <p className="muted">読み込み中…</p>;
  if (data.error) return <p className="error">データを読み込めませんでした：{data.error}</p>;

  const close = () => {
    setEditing(null);
    window.history.replaceState(null, '', '/events');
  };

  const target = editing && editing !== 'new' ? data.events.find((e) => e.id === editing) : undefined;
  if (editing) {
    return (
      <div>
        <div className="page-head">
          <h1>{target ? '催事を編集' : '催事を登録'}</h1>
        </div>
        <div className="card">
          <EventForm key={editing} initial={target} onSaved={close} onCancel={close} />
        </div>
      </div>
    );
  }

  const shiftCount = (id: string) => data.shifts.filter((s) => s.eventId === id && s.status !== 'cancelled').length;
  const remove = async (ev: EventItem) => {
    if (data.shifts.some((s) => s.eventId === ev.id)) {
      alert('この催事には出勤予定が登録されているため削除できません。\n先に出勤予定を削除してください。');
      return;
    }
    if (confirm(`「${ev.venue}」を削除しますか？`)) await store.remove('events', ev.id);
  };

  const isPast = (ev: EventItem) => !!ev.endDate && ev.endDate < now.date;
  const sorted = [...data.events].sort((a, b) => (a.startDate || '9999').localeCompare(b.startDate || '9999'));
  const current = sorted.filter((e) => !isPast(e));
  const past = sorted.filter(isPast).reverse();

  const renderList = (list: EventItem[]) => (
    <ul className="task-list">
      {list.map((ev) => (
        <li key={ev.id} className="task-item" style={{ borderLeft: `5px solid ${venueColor(ev.venue)}` }}>
          <div className="grow">
            <div className="title">{ev.venue}</div>
            <div className="small muted">
              {[ev.name, ev.facility, formatPeriod(ev.startDate, ev.endDate)].filter(Boolean).join(' ・ ')}
            </div>
            <div className="small muted">出勤 {shiftCount(ev.id)}件</div>
          </div>
          <div className="form-actions" style={{ flexDirection: 'column' }}>
            <button className="btn btn-outline btn-sm" onClick={() => setEditing(ev.id)}>
              編集
            </button>
            <button className="btn-link small" style={{ color: 'var(--danger)' }} onClick={() => remove(ev)}>
              削除
            </button>
          </div>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="stack">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <h1>催事・会場</h1>
        <button className="btn btn-primary btn-sm" onClick={() => setEditing('new')}>
          <Icon name="plus" size={18} />
          登録
        </button>
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        会場・開催期間・持ち物などをここで登録すると、各出勤予定に表示されます。
      </p>

      {data.events.length === 0 ? (
        <p className="empty-msg">登録された催事はありません</p>
      ) : (
        <>
          <section className="task-group">
            <h3>開催中・これから</h3>
            {current.length ? renderList(current) : <p className="empty-msg">ありません</p>}
          </section>
          {past.length > 0 && (
            <section className="task-group">
              <h3>終了した催事</h3>
              {renderList(past)}
            </section>
          )}
        </>
      )}
    </div>
  );
}
