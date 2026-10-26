'use client';

import Link from 'next/link';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useStore } from './AppProvider';
import { formatDateJa, formatTimeRange } from '@/lib/schedule';
import {
  SHIFT_STATUS_LABEL,
  type Deadline,
  type EventItem,
  type Shift,
  type ShiftStatus,
  type Task,
} from '@/lib/types';

/** 保存中の二重送信防止とエラー表示をまとめたもの */
function useSubmit() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(`保存できませんでした：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

function Actions({ busy, error, onCancel, label = '保存する' }: { busy: boolean; error: string; onCancel?: () => void; label?: string }) {
  return (
    <>
      {error && <p className="error">{error}</p>}
      <div className="form-actions">
        {onCancel && (
          <button type="button" className="btn btn-outline" onClick={onCancel}>
            キャンセル
          </button>
        )}
        <button className="btn btn-primary" disabled={busy}>
          {busy ? '保存中…' : label}
        </button>
      </div>
    </>
  );
}

function Choice<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="choice" role="radiogroup">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          className={value === v ? 'active' : ''}
          onClick={() => onChange(v)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

const Field = ({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) => (
  <label>
    {label}
    {children}
    {hint && <span className="hint">{hint}</span>}
  </label>
);

// ---------------- 出勤 ----------------

export function ShiftForm({
  initial,
  defaultDate = '',
  events,
  onSaved,
  onCancel,
}: {
  initial?: Shift;
  defaultDate?: string;
  events: EventItem[];
  onSaved: (id: string) => void;
  onCancel?: () => void;
}) {
  const store = useStore();
  const { busy, error, run } = useSubmit();
  const [f, setF] = useState({
    eventId: initial?.eventId ?? (events.length === 1 ? events[0].id : ''),
    date: initial?.date ?? defaultDate,
    startTime: initial?.startTime ?? '',
    endTime: initial?.endTime ?? '',
    staff: initial?.staff ?? '',
    role: initial?.role ?? '',
    status: initial?.status ?? ('tentative' as ShiftStatus),
    notes: initial?.notes ?? '',
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  if (events.length === 0) {
    return (
      <div className="empty-msg">
        先に催事（会場・イベント）を登録してください。
        <div style={{ marginTop: 12 }}>
          <Link href="/events" className="btn btn-primary">
            催事を登録する
          </Link>
        </div>
      </div>
    );
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      if (initial) {
        await store.update('shifts', initial.id, f);
        onSaved(initial.id);
      } else {
        onSaved(await store.add('shifts', f));
      }
    });
  };

  const sorted = [...events].sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));

  return (
    <form className="form" onSubmit={submit}>
      <Field label="催事・会場" hint="一覧にない場合は「催事」画面で先に登録します">
        <select required value={f.eventId} onChange={set('eventId')}>
          <option value="">選択してください</option>
          {sorted.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.venue}
              {ev.name ? `（${ev.name}）` : ''}
            </option>
          ))}
        </select>
      </Field>
      <Field label="出勤日">
        <input type="date" required value={f.date} onChange={set('date')} />
      </Field>
      <div className="row">
        <Field label="開始時刻">
          <input type="time" value={f.startTime} onChange={set('startTime')} />
        </Field>
        <Field label="終了時刻" hint="開始より前なら翌日終了">
          <input type="time" value={f.endTime} onChange={set('endTime')} />
        </Field>
      </div>
      <div className="row">
        <Field label="担当スタッフ">
          <input value={f.staff} onChange={set('staff')} placeholder="例：山田" />
        </Field>
        <Field label="役割">
          <input value={f.role} onChange={set('role')} placeholder="例：レジ・販売" />
        </Field>
      </div>
      <Field label="状態" hint="「確定」にした出勤だけがホームの「次の出勤」に表示されます">
        <Choice
          value={f.status}
          options={Object.entries(SHIFT_STATUS_LABEL) as [ShiftStatus, string][]}
          onChange={(status) => setF({ ...f, status })}
        />
      </Field>
      <Field label="この日の連絡事項">
        <textarea value={f.notes} onChange={set('notes')} placeholder="集合場所、入館方法など" />
      </Field>
      <Actions busy={busy} error={error} onCancel={onCancel} />
    </form>
  );
}

// ---------------- 催事 ----------------

export function EventForm({ initial, onSaved, onCancel }: { initial?: EventItem; onSaved: () => void; onCancel?: () => void }) {
  const store = useStore();
  const { busy, error, run } = useSubmit();
  const [f, setF] = useState({
    name: initial?.name ?? '',
    venue: initial?.venue ?? '',
    facility: initial?.facility ?? '',
    startDate: initial?.startDate ?? '',
    endDate: initial?.endDate ?? '',
    belongings: initial?.belongings ?? '',
    notes: initial?.notes ?? '',
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      if (initial) await store.update('events', initial.id, f);
      else await store.add('events', f);
      onSaved();
    });
  };

  return (
    <form className="form" onSubmit={submit}>
      <Field label="会場名（必須）">
        <input required value={f.venue} onChange={set('venue')} placeholder="例：〇〇百貨店 本店" />
      </Field>
      <Field label="催事名・イベント名">
        <input value={f.name} onChange={set('name')} placeholder="例：北海道物産展" />
      </Field>
      <Field label="施設・売場">
        <input value={f.facility} onChange={set('facility')} placeholder="例：7階 催事場" />
      </Field>
      <div className="row">
        <Field label="開催開始日">
          <input type="date" value={f.startDate} onChange={set('startDate')} />
        </Field>
        <Field label="開催終了日">
          <input type="date" value={f.endDate} min={f.startDate || undefined} onChange={set('endDate')} />
        </Field>
      </div>
      <Field label="持ち物・事前準備">
        <textarea value={f.belongings} onChange={set('belongings')} placeholder="例：制服、名札、印鑑" />
      </Field>
      <Field label="連絡事項">
        <textarea value={f.notes} onChange={set('notes')} placeholder="例：従業員入口は北側" />
      </Field>
      <Actions busy={busy} error={error} onCancel={onCancel} />
    </form>
  );
}

// ---------------- タスク ----------------

export function TaskForm({
  initial,
  shiftOptions,
  eventMap,
  fixedShiftId,
  onSaved,
  onCancel,
}: {
  initial?: Task;
  shiftOptions: Shift[];
  eventMap: Map<string, EventItem>;
  fixedShiftId?: string;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const store = useStore();
  const { busy, error, run } = useSubmit();
  const [f, setF] = useState({
    title: initial?.title ?? '',
    date: initial?.date ?? '',
    time: initial?.time ?? '',
    shiftId: initial?.shiftId ?? fixedShiftId ?? '',
    notes: initial?.notes ?? '',
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      if (initial) await store.update('tasks', initial.id, f);
      else await store.add('tasks', { ...f, status: 'todo' });
      onSaved();
    });
  };

  return (
    <form className="form" onSubmit={submit}>
      <Field label="タスク名">
        <input required value={f.title} onChange={set('title')} placeholder="例：制服をクリーニングに出す" />
      </Field>
      <div className="row">
        <Field label="実施日・期限">
          <input type="date" value={f.date} onChange={set('date')} />
        </Field>
        <Field label="時刻">
          <input type="time" value={f.time} onChange={set('time')} />
        </Field>
      </div>
      {!fixedShiftId && (
        <Field label="関連する出勤（準備タスクの場合）">
          <select value={f.shiftId} onChange={set('shiftId')}>
            <option value="">なし</option>
            {shiftOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {formatDateJa(s.date)} {eventMap.get(s.eventId)?.venue || '会場未設定'} {formatTimeRange(s.startTime, s.endTime)}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label="メモ">
        <textarea value={f.notes} onChange={set('notes')} />
      </Field>
      <Actions busy={busy} error={error} onCancel={onCancel} />
    </form>
  );
}

// ---------------- 提出期限 ----------------

export function DeadlineForm({ initial, onSaved, onCancel }: { initial?: Deadline; onSaved: () => void; onCancel?: () => void }) {
  const store = useStore();
  const { busy, error, run } = useSubmit();
  const [f, setF] = useState({
    title: initial?.title ?? '',
    date: initial?.date ?? '',
    time: initial?.time ?? '',
    notes: initial?.notes ?? '',
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      if (initial) await store.update('deadlines', initial.id, f);
      else await store.add('deadlines', { ...f, done: false });
      onSaved();
    });
  };

  return (
    <form className="form" onSubmit={submit}>
      <Field label="項目名">
        <input required value={f.title} onChange={set('title')} placeholder="例：12月分シフト提出" />
      </Field>
      <div className="row">
        <Field label="期限日">
          <input type="date" required value={f.date} onChange={set('date')} />
        </Field>
        <Field label="時刻">
          <input type="time" value={f.time} onChange={set('time')} />
        </Field>
      </div>
      <Field label="メモ">
        <textarea value={f.notes} onChange={set('notes')} placeholder="提出先など" />
      </Field>
      <Actions busy={busy} error={error} onCancel={onCancel} />
    </form>
  );
}
