import Link from 'next/link';
import { formatTimeRange, parseYmd, venueColor, WEEKDAYS } from '@/lib/schedule';
import { SHIFT_STATUS_LABEL, type EventItem, type Shift, type ShiftStatus } from '@/lib/types';

export function ShiftStatusBadge({ status }: { status: ShiftStatus }) {
  return <span className={`badge badge-${status}`}>{SHIFT_STATUS_LABEL[status]}</span>;
}

/** 出勤1件の行。会場ごとに左端の色を変えて区別する */
export function ShiftRow({
  shift,
  event,
  highlight,
  extra,
}: {
  shift: Shift;
  event?: EventItem;
  highlight?: string;
  extra?: string;
}) {
  const d = parseYmd(shift.date);
  const venue = event?.venue || '会場未設定';
  const dow = d.getDay();
  return (
    <Link
      href={`/shifts/${shift.id}`}
      className={`shift-row ${shift.status === 'cancelled' ? 'is-cancelled' : ''}`}
      style={{ borderLeftColor: venueColor(venue) }}
    >
      <div className={`shift-date ${dow === 0 ? 'sun' : dow === 6 ? 'sat' : ''}`}>
        <span className="md">
          {d.getMonth() + 1}/{d.getDate()}
        </span>
        <span className="dow">{WEEKDAYS[dow]}</span>
      </div>
      <div className="shift-body">
        <div className="shift-venue">{venue}</div>
        <div className="small muted">
          {[formatTimeRange(shift.startTime, shift.endTime), event?.name, shift.role].filter(Boolean).join(' ・ ')}
        </div>
        {extra && <div className="small muted">{extra}</div>}
      </div>
      <div className="shift-meta">
        {highlight && <span className="badge badge-next">{highlight}</span>}
        <ShiftStatusBadge status={shift.status} />
      </div>
    </Link>
  );
}
