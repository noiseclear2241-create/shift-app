'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ShiftForm } from '@/components/forms';
import { useAllData } from '@/lib/hooks';

export default function NewShiftPage() {
  const router = useRouter();
  const data = useAllData();
  // カレンダーから来たときは ?date=YYYY-MM-DD の日付を初期値にする
  const [date, setDate] = useState<string | null>(null);
  useEffect(() => {
    const d = new URLSearchParams(window.location.search).get('date') ?? '';
    setDate(/^\d{4}-\d{2}-\d{2}$/.test(d) ? d : '');
  }, []);

  if (data.loading || date === null) return <p className="muted">読み込み中…</p>;

  return (
    <div>
      <div className="page-head">
        <h1>出勤予定を登録</h1>
      </div>
      <div className="card">
        <ShiftForm
          events={data.events}
          defaultDate={date}
          onSaved={(id) => router.replace(`/shifts/${id}`)}
          onCancel={() => router.back()}
        />
      </div>
    </div>
  );
}
