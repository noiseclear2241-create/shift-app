import Link from 'next/link';
import {
  countdownLabel,
  formatDateJa,
  formatPeriod,
  formatTimeRange,
  shiftPhase,
  venueColor,
  type Now,
} from '@/lib/schedule';
import { TASK_STATUS_LABEL, type EventItem, type Shift, type Task } from '@/lib/types';
import { Icon } from './Icon';

/** ダッシュボード最上部の「次の出勤」カード */
export function NextShiftCard({
  shift,
  event,
  prepTasks,
  tentativeCount,
  now,
  onToggleTask,
  canEdit,
}: {
  shift: Shift | null;
  event?: EventItem;
  prepTasks: Task[];
  tentativeCount: number;
  now: Now;
  onToggleTask: (t: Task) => void;
  /** 出勤を登録できる人（個人用、またはチームのオーナー・管理者） */
  canEdit: boolean;
}) {
  if (!shift) {
    return (
      <section className="card next-card empty">
        <div className="next-label">次の出勤</div>
        <p className="next-empty">次の出勤予定はありません</p>
        {tentativeCount > 0 && (
          <p className="small muted">未確定の出勤予定が {tentativeCount} 件あります（確定するとここに表示されます）</p>
        )}
        {canEdit && (
          <Link href="/shifts/new" className="btn btn-outline">
            <Icon name="plus" size={18} />
            出勤予定を登録
          </Link>
        )}
      </section>
    );
  }

  const isToday = shift.date === now.date;
  const working = shiftPhase(shift, now) === 'working';
  const venue = event?.venue || '会場未設定';
  const label = isToday ? (working ? '本日の出勤（勤務中）' : '本日の出勤') : '次の出勤';
  const belongings = event?.belongings?.trim();
  const notes = [event?.notes?.trim(), shift.notes?.trim()].filter(Boolean);

  return (
    <section className={`card next-card ${isToday ? 'is-today' : ''}`} style={{ borderTopColor: venueColor(venue) }}>
      <div className="next-head">
        <span className="next-label">{label}</span>
        <span className="countdown">{countdownLabel(shift.date, now)}</span>
      </div>

      <div className="next-date">{formatDateJa(shift.date)}</div>
      <div className="next-venue">
        <Icon name="pin" size={22} />
        {venue}
      </div>

      <dl className="next-facts">
        <div>
          <dt>勤務時間</dt>
          <dd>{formatTimeRange(shift.startTime, shift.endTime)}</dd>
        </div>
        {event?.name && (
          <div>
            <dt>催事</dt>
            <dd>{event.name}</dd>
          </div>
        )}
        {event?.facility && (
          <div>
            <dt>施設</dt>
            <dd>{event.facility}</dd>
          </div>
        )}
        {event?.startDate && (
          <div>
            <dt>開催期間</dt>
            <dd>{formatPeriod(event.startDate, event.endDate)}</dd>
          </div>
        )}
        {(shift.staff || shift.role) && (
          <div>
            <dt>担当・役割</dt>
            <dd>{[shift.staff, shift.role].filter(Boolean).join(' / ')}</dd>
          </div>
        )}
      </dl>

      {(belongings || notes.length > 0 || prepTasks.length > 0) && (
        // 最初の画面で「今日の予定」まで見えるよう、詳細は折りたたむ（見出しに件数だけ出す）
        <details className="next-more">
          <summary>
            {[
              belongings && '持ち物',
              notes.length > 0 && '連絡事項',
              prepTasks.length > 0 &&
                `準備タスク ${prepTasks.length}件（未完了 ${prepTasks.filter((t) => t.status !== 'done').length}）`,
            ]
              .filter(Boolean)
              .join('・')}
          </summary>
          <div className="next-more-body">
            {belongings && (
              <div className="next-note">
                <div className="note-title">
                  <Icon name="bag" size={16} />
                  持ち物・事前準備
                </div>
                <p>{belongings}</p>
              </div>
            )}
            {notes.length > 0 && (
              <div className="next-note">
                <div className="note-title">
                  <Icon name="note" size={16} />
                  連絡事項
                </div>
                {notes.map((n, i) => (
                  <p key={i}>{n}</p>
                ))}
              </div>
            )}

            {prepTasks.length > 0 && (
              <div className="next-note">
                <div className="note-title">
                  <Icon name="check" size={16} />
                  この出勤の準備タスク
                </div>
                <ul className="prep-list">
                  {prepTasks.map((t) => (
                    <li key={t.id} className={t.status === 'done' ? 'done' : ''}>
                      <button className={`status-btn status-${t.status}`} onClick={() => onToggleTask(t)}>
                        {TASK_STATUS_LABEL[t.status]}
                      </button>
                      <span>{t.title}</span>
                      {t.date && <span className="small muted">{formatDateJa(t.date)}まで</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </details>
      )}

      <Link href={`/shifts/${shift.id}`} className="btn btn-primary block">
        詳細を見る
        <Icon name="chevron" size={18} />
      </Link>
    </section>
  );
}
