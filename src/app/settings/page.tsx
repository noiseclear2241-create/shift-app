'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useApp, useStore } from '@/components/AppProvider';
import { PushSection } from '@/components/PushSection';
import { callApi } from '@/lib/api';
import { useAllData, useNow } from '@/lib/hooks';
import { buildMorningNotifications, nextMorning } from '@/lib/notifications';
import { formatDateJa, isMyShift, isMyTask } from '@/lib/schedule';
import { DEFAULT_NOTIFICATION_PREFS, type NotificationPrefs } from '@/lib/types';

type Platform = 'ios' | 'android' | 'other';

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  // iPad は Mac と同じ表示になるため、タッチ対応かどうかも見る
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'other';
}

/** ホーム画面に追加したアプリとして開いているか */
function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

const PREF_ITEMS: { key: keyof NotificationPrefs; label: string; detail: string }[] = [
  { key: 'deadline', label: '提出期限', detail: 'シフト提出期限などの3日前・前日・当日の朝' },
  { key: 'nextShift', label: '明日の出勤', detail: '出勤の前日の朝（確定した出勤のみ）' },
  { key: 'todayDigest', label: '今日の予定', detail: '当日の朝に、今日の出勤・タスク・期限切れのタスク' },
];

export default function SettingsPage() {
  const { userName, signOut, viewer, workspace } = useApp();
  const store = useStore();
  const now = useNow();
  const data = useAllData();
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [saveState, setSaveState] = useState<'' | 'saving' | 'saved' | 'error'>('');
  const [env, setEnv] = useState<{ platform: Platform; standalone: boolean } | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (store.mode !== 'firebase') return;
    callApi<{ admin: boolean }>('/api/admin/me', { method: 'GET' }).then((r) => setIsAdmin(r.admin), () => {});
  }, [store.mode]);

  useEffect(() => {
    setEnv({ platform: detectPlatform(), standalone: isStandalone() });
    store.getPrefs().then(setPrefs, () => {
      // 読み込めなくても画面は表示する（Firestore のルールが古いままのときなど）
      setPrefs(DEFAULT_NOTIFICATION_PREFS);
      setLoadError(true);
    });
  }, [store]);

  const toggle = async (key: keyof NotificationPrefs) => {
    if (!prefs) return;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setSaveState('saving');
    try {
      await store.savePrefs(next);
      setSaveState('saved');
    } catch {
      setPrefs(prefs);
      setSaveState('error');
    }
  };

  if (!now || !prefs || !env || data.loading) return <p className="muted">読み込み中…</p>;

  const morning = nextMorning(now);
  // 今見ているスペースについての見本（チームでは自分の担当分だけ。実際の通知は全スペース分が届く）
  const preview = buildMorningNotifications(
    morning,
    {
      ...data,
      shifts: data.shifts.filter((s) => isMyShift(s, viewer)),
      tasks: data.tasks.filter((t) => isMyTask(t, viewer)),
    },
    prefs,
    workspace?.type === 'team' ? `【${workspace.name}】` : '',
  );

  return (
    <div className="stack">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <h1>設定</h1>
      </div>

      <section className="card stack">
        <h2>ホーム画面に追加</h2>
        {env.standalone ? (
          <p className="ok-msg">ホーム画面のアプリとして開いています。</p>
        ) : (
          <>
            <p className="small muted" style={{ margin: 0 }}>
              ホーム画面に追加すると、アプリのようにすぐ開けます。
              <b>iPhone でプッシュ通知を受け取るには、ホーム画面への追加が必要です。</b>
            </p>
            <div className={`howto ${env.platform === 'ios' ? 'is-current' : ''}`}>
              <div className="howto-title">iPhone（Safari）{env.platform === 'ios' && <span className="badge badge-next">この端末</span>}</div>
              <ol>
                <li>Safari でこのアプリを開く（Chrome など他のアプリからは追加できません）</li>
                <li>画面下の共有ボタン（□に↑のマーク）を押す</li>
                <li>「ホーム画面に追加」→「追加」を押す</li>
                <li>ホーム画面の「シフト手帳」アイコンから開き、もう一度ログインする</li>
              </ol>
              <p className="small muted">iOS 16.4 以降が必要です。ホーム画面のアプリと Safari ではログイン状態が別々になります。</p>
            </div>
            <div className={`howto ${env.platform === 'android' ? 'is-current' : ''}`}>
              <div className="howto-title">Android（Chrome）{env.platform === 'android' && <span className="badge badge-next">この端末</span>}</div>
              <ol>
                <li>Chrome でこのアプリを開く</li>
                <li>右上の「︙」メニューを押す</li>
                <li>「ホーム画面に追加」または「アプリをインストール」を押す</li>
              </ol>
            </div>
          </>
        )}
      </section>

      <section className="card stack">
        <div className="section-head" style={{ marginBottom: 0 }}>
          <h2>通知</h2>
          <span className="small muted" aria-live="polite">
            {saveState === 'saving' ? '保存中…' : saveState === 'saved' ? '保存しました' : saveState === 'error' ? '保存できませんでした' : ''}
          </span>
        </div>
        <p className="small muted" style={{ margin: 0 }}>
          毎朝7時台に、オンにした種類の通知をまとめて送ります。
        </p>
        {loadError && (
          <p className="error small" style={{ margin: 0 }}>
            保存済みの通知設定を読み込めませんでした。Firestore のルールが最新か確認してください（初期設定を表示しています）。
          </p>
        )}
        <ul className="switch-list">
          {PREF_ITEMS.map((item) => (
            <li key={item.key}>
              <label className="switch-row">
                <span>
                  <span className="switch-label">{item.label}</span>
                  <span className="small muted">{item.detail}</span>
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  aria-label={item.label}
                  className="switch"
                  checked={prefs[item.key]}
                  onChange={() => toggle(item.key)}
                />
              </label>
            </li>
          ))}
        </ul>
        <div className="notice-box stack" style={{ gap: 8 }}>
          <b>この端末で通知を受け取る</b>
          <PushSection />
          <p className="small muted" style={{ margin: 0 }}>
            登録した端末には、毎朝7時台に自動で届きます（サーバーの都合で、時刻は7時〜8時の間で前後します）。同じ通知は1日1回だけ送ります。
          </p>
        </div>
      </section>

      <section className="card">
        <div className="section-head">
          <h2>{formatDateJa(morning)}の朝に届く予定の通知</h2>
        </div>
        {preview.length === 0 ? (
          <p className="empty-msg">送る通知はありません</p>
        ) : (
          <ul className="preview-list">
            {preview.map((n) => (
              <li key={n.key}>
                <Link href={n.url}>
                  <div className="preview-title">{n.title}</div>
                  <div className="small muted">{n.body}</div>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="small muted" style={{ marginBottom: 0 }}>
          今の登録内容とスイッチから計算した見本です。予定を変更すると、送る内容も変わります。
        </p>
      </section>

      <section className="card stack">
        <h2>アカウント</h2>
        <div>{userName}</div>
        {isAdmin && (
          <Link href="/admin/ads" className="link-card" style={{ marginBottom: 0 }}>
            <span>
              <b>運営者メニュー：広告の管理</b>
            </span>
            <span aria-hidden="true">›</span>
          </Link>
        )}
        {store.mode === 'firebase' && (
          <button className="btn btn-outline" onClick={signOut}>
            ログアウト
          </button>
        )}
      </section>
    </div>
  );
}
