// アプリで扱うデータの形。Firestore は undefined を保存できないため、未入力は空文字で持つ。

/** 出勤の状態。キャンセルは削除せず状態として残す（変更履歴がわかるように）。 */
export type ShiftStatus = 'confirmed' | 'tentative' | 'cancelled';

/** タスクの状態 */
export type TaskStatus = 'todo' | 'doing' | 'done';

export type CollectionName = 'events' | 'shifts' | 'tasks' | 'deadlines';

interface Timestamps {
  createdAt: number;
  updatedAt: number;
}

/** 催事・イベント（会場や開催期間など、複数の出勤で共有する情報） */
export interface EventItem extends Timestamps {
  id: string;
  name: string;
  venue: string;
  facility: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  belongings: string;
  notes: string;
}

/** 1日分の出勤予定 */
export interface Shift extends Timestamps {
  id: string;
  eventId: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm（開始より前なら翌日終了）
  staff: string;
  role: string;
  status: ShiftStatus;
  notes: string;
}

export interface Task extends Timestamps {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD（空なら日付なし）
  time: string; // HH:mm（空なら時間指定なし）
  status: TaskStatus;
  shiftId: string; // 準備タスクとして紐づく出勤（空なら紐づけなし）
  notes: string;
}

/** シフト提出期限など、締め切りのある項目 */
export interface Deadline extends Timestamps {
  id: string;
  title: string;
  date: string;
  time: string;
  done: boolean;
  notes: string;
}

/** 通知の種類ごとのオン・オフ（ユーザーごとに users/{uid} に保存） */
export interface NotificationPrefs {
  deadline: boolean; // 提出期限（3日前・前日・当日）
  nextShift: boolean; // 明日の出勤（確定のみ）
  todayDigest: boolean; // 今日の予定・期限切れタスク
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  deadline: true,
  nextShift: true,
  todayDigest: true,
};

export const SHIFT_STATUS_LABEL: Record<ShiftStatus, string> = {
  confirmed: '確定',
  tentative: '未確定',
  cancelled: 'キャンセル',
};

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  todo: '未完了',
  doing: '進行中',
  done: '完了',
};
