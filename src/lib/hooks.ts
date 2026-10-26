'use client';

import { useEffect, useMemo, useState } from 'react';
import { useStore } from '@/components/AppProvider';
import { toNow, type Now } from './schedule';
import type { CollectionName, Deadline, EventItem, Shift, Task } from './types';

/** コレクションをリアルタイムで読み込む（他の端末での変更もすぐ反映される） */
export function useCollection<T>(name: CollectionName) {
  const store = useStore();
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
    );
  }, [store, name]);

  return { items, loading, error };
}

/** 画面で使う4種類のデータをまとめて読み込む */
export function useAllData() {
  const events = useCollection<EventItem>('events');
  const shifts = useCollection<Shift>('shifts');
  const tasks = useCollection<Task>('tasks');
  const deadlines = useCollection<Deadline>('deadlines');
  const eventMap = useMemo(() => new Map(events.items.map((e) => [e.id, e])), [events.items]);
  return {
    events: events.items,
    eventMap,
    shifts: shifts.items,
    tasks: tasks.items,
    deadlines: deadlines.items,
    loading: events.loading || shifts.loading || tasks.loading || deadlines.loading,
    error: events.error || shifts.error || tasks.error || deadlines.error,
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
