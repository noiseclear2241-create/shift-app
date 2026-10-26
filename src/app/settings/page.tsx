'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useApp, useStore } from '@/components/AppProvider';
import { useAllData, useNow } from '@/lib/hooks';
import { buildMorningNotifications, nextMorning } from '@/lib/notifications';
import { formatDateJa } from '@/lib/schedule';
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
  const { userName, signOut } = useApp();
  const store = useStore();
  const now = useNow();
  const data = useAllData();
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [saveState, setSaveState] = useState<'' | 'saving' | 'saved' | 'error'>('');
  const [env, setEnv] = useState<{ platform: Platform; standalone: boolean } | null>(null);
  const [loadError, setLoadError] = useState(false);

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
  const preview = buildMorningNotifications(morning, data, prefs);

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
        <div className="notice-box">
          <b>プッシュ通知の受け取り</b>
          <p className="small" style={{ margin: '4px 0 0' }}>
            この端末で通知を受け取る設定は、次の更新で追加します。それまでは、ホーム画面の「期限が近い・過ぎている項目」と「次の出勤」で確認してください。
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
        {store.mode === 'firebase' && (
          <button className="btn btn-outline" onClick={signOut}>
            ログアウト
          </button>
        )}
      </section>
    </div>
  );
}
