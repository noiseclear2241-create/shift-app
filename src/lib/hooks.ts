'use client';

import { useEffect, useMemo, useState } from 'react';
import { useApp, useStore } from '@/components/AppProvider';
import { toNow, type Now } from './schedule';
import type { Filter } from './store';
import type {
  Availability,
  AvailabilityPeriod,
  CollectionName,
  Deadline,
  EventItem,
  Shift,
  Task,
} from './types';

/** コレクションをリアルタイムで読み込む（他の端末での変更もすぐ反映される） */
export function useCollection<T>(name: CollectionName, filter?: Filter) {
  const store = useStore();
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const field = filter?.field;
  const value = filter?.value;

  useEffect(() => {
    setLoading(true);
    return store.subscribe<T>(
      name,
      (list) => {
        setItems(list);
        setLoading(false);
        setError('');
      },
      (e) => {
        setError(e.message);
        setLoading(false);
      },
      field && value !== undefined ? { field, value } : undefined,
    );
  }, [store, name, field, value]);

  return { items, loading, error };
}

/**
 * 画面で使うデータをまとめて読み込む。
 * シフト希望の回答は、ルールで本人分しか読めないため、自分の分だけを読む。
 * pendingAvailability：受付中で、自分がまだ提出していないシフト希望の受付。
 */
export function useAllData() {
  const { uid } = useApp();
  const events = useCollection<EventItem>('events');
  const shifts = useCollection<Shift>('shifts');
  const tasks = useCollection<Task>('tasks');
  const deadlines = useCollection<Deadline>('deadlines');
  const periods = useCollection<AvailabilityPeriod>('availabilityPeriods');
  const mine = useCollection<Availability>('availability', { field: 'uid', value: uid });

  const eventMap = useMemo(() => new Map(events.items.map((e) => [e.id, e])), [events.items]);
  const pendingAvailability = useMemo(() => {
    const submitted = new Set(mine.items.filter((a) => a.submittedAt).map((a) => a.periodId));
    return periods.items.filter((p) => p.status === 'open' && !submitted.has(p.id));
  }, [periods.items, mine.items]);

  const all = [events, shifts, tasks, deadlines, periods, mine];
  return {
    events: events.items,
    eventMap,
    shifts: shifts.items,
    tasks: tasks.items,
    deadlines: deadlines.items,
    periods: periods.items,
    myAvailability: mine.items,
    pendingAvailability,
    loading: all.some((c) => c.loading),
    error: all.map((c) => c.error).find(Boolean) ?? '',
  };
}

/** 現在時刻（1分ごとに更新。日付が変わったら表示も切り替わる） */
export function useNow(): Now | null {
  const [now, setNow] = useState<Now | null>(null);
  useEffect(() => {
    const tick = () => setNow(toNow(new Date()));
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}
