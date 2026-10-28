'use client';

import { useEffect, useState } from 'react';
import { useApp } from './AppProvider';
import { disablePush, enablePush, getPushStatus, sendMorningNow, sendTestPush, type PushStatus } from '@/lib/push';

/** 設定画面の「この端末で通知を受け取る」部分 */
export function PushSection() {
  const { uid, store } = useApp();
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    getPushStatus().then(setStatus, () => setStatus('unsupported'));
  }, []);

  if (store?.mode !== 'firebase') {
    return <p className="small muted">プッシュ通知は、Firebase に接続した公開版で使えます。</p>;
  }
  if (!status) return <p className="small muted">確認中…</p>;

  const run = async (fn: () => Promise<string>) => {
    setBusy(true);
    setMessage(null);
    try {
      setMessage({ ok: true, text: await fn() });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setStatus(await getPushStatus().catch(() => 'unsupported' as const));
      setBusy(false);
    }
  };

  const explain: Partial<Record<PushStatus, string>> = {
    'not-configured': '通知の準備中です（管理者側の設定が終わると使えるようになります）。',
    'needs-home-screen':
      'iPhone では、このアプリを「ホーム画面に追加」して、ホーム画面のアイコンから開いたときだけ通知を受け取れます。上の手順で追加してください。',
    unsupported: 'この端末・ブラウザはプッシュ通知に対応していません。Android は Chrome、iPhone はホーム画面に追加したアプリでお試しください。',
    denied:
      '通知がブロックされています。端末の設定（iPhone：設定 → 通知 → シフト手帳／Android：Chrome のサイト設定 → 通知）で許可してから、ページを開き直してください。',
  };

  const onEnable = () =>
    run(async () => {
      await enablePush(uid);
      return 'この端末を登録しました。「テスト通知を送る」で届くか確かめてください。';
    });
  const onTest = () =>
    run(async () => {
      const r = await sendTestPush();
      return `テスト通知を送りました（${r.sent}台に送信${r.failed ? `・${r.failed}台は失敗` : ''}）。数秒〜1分ほどで届きます。`;
    });
  const onMorningNow = () =>
    run(async () => {
      const r = await sendMorningNow();
      if (r.total === 0) return '今日の朝に送る通知はありません（予定・期限・通知の設定を確認してください）。';
      if (r.sent === 0 && r.skipped > 0) return '今日の通知はすでに送信済みです（同じ通知は1日1回だけ送ります）。';
      return `今朝の通知を${r.sent}件送りました${r.skipped ? `（${r.skipped}件は送信済みのため省略）` : ''}。`;
    });
  const onDisable = () =>
    run(async () => {
      await disablePush(uid);
      return 'この端末の通知を止めました。';
    });

  return (
    <div className="stack" style={{ gap: 10 }}>
      {explain[status] && (
        <p className="small" style={{ margin: 0 }}>
          {explain[status]}
        </p>
      )}

      {status === 'off' && (
        <button className="btn btn-primary" disabled={busy} onClick={onEnable}>
          この端末で通知を受け取る
        </button>
      )}

      {status === 'on' && (
        <>
          <p className="ok-msg">この端末は通知を受け取る設定になっています。</p>
          <button className="btn btn-primary" disabled={busy} onClick={onTest}>
            テスト通知を送る
          </button>
          <button className="btn btn-outline" disabled={busy} onClick={onMorningNow}>
            今朝の通知を今すぐ受け取る（お試し）
          </button>
          <button className="btn btn-outline" disabled={busy} onClick={onDisable}>
            この端末の通知をやめる
          </button>
        </>
      )}

      {message && (
        <p className={message.ok ? 'small muted' : 'error small'} style={{ margin: 0 }} aria-live="polite">
          {message.text}
        </p>
      )}
    </div>
  );
}
