'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useApp } from '@/components/AppProvider';
import { callApi } from '@/lib/api';
import { ROLE_LABEL, type Role } from '@/lib/types';

type Info =
  | { valid: false; reason: string }
  | { valid: true; workspaceId: string; workspaceName: string; role: Role; alreadyMember: boolean };

/** 招待リンクを開いたときの画面（ログインしていなければ、ログイン後にここへ戻る） */
export default function JoinPage({ params }: { params: { code: string } }) {
  const { switchWorkspace, store, workspaces } = useApp();
  const router = useRouter();
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [joinedId, setJoinedId] = useState('');

  useEffect(() => {
    if (store?.mode !== 'firebase') return;
    callApi<Info>(`/api/invites/${encodeURIComponent(params.code)}`, { method: 'GET' }).then(setInfo, (e) =>
      setError(e instanceof Error ? e.message : String(e)),
    );
  }, [params.code, store?.mode]);

  // 参加したチームが一覧に反映されたら、そのチームに切り替えてホームへ
  useEffect(() => {
    if (joinedId && workspaces.some((w) => w.id === joinedId)) {
      switchWorkspace(joinedId);
      router.replace('/');
    }
  }, [joinedId, workspaces, switchWorkspace, router]);

  const join = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await callApi<{ workspaceId: string }>(`/api/invites/${encodeURIComponent(params.code)}`);
      setJoinedId(r.workspaceId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  if (store?.mode !== 'firebase') return <p className="muted">招待は、Firebase に接続した公開版で使えます。</p>;

  return (
    <div className="card login-card" style={{ margin: '24px auto' }}>
      <h1>チームへの招待</h1>
      {error && <p className="error">{error}</p>}
      {!info && !error && <p className="muted">招待を確認しています…</p>}
      {info && !info.valid && (
        <>
          <p className="error">{info.reason}</p>
          <Link href="/" className="btn btn-outline">
            ホームへ
          </Link>
        </>
      )}
      {info?.valid && (
        <>
          <p style={{ margin: 0 }}>
            <b>{info.workspaceName}</b> に <b>{ROLE_LABEL[info.role]}</b> として招待されています。
          </p>
          {info.alreadyMember ? (
            <>
              <p className="small muted">すでにこのチームのメンバーです。</p>
              <button className="btn btn-primary" onClick={() => setJoinedId(info.workspaceId)}>
                チームを開く
              </button>
            </>
          ) : (
            <>
              <p className="small muted" style={{ margin: 0 }}>
                参加すると、チームの催事・出勤予定が見られるようになります。チームのメンバーには、あなたの名前（Google の名前またはメールアドレス）が表示されます。
              </p>
              <button className="btn btn-primary" disabled={busy} onClick={join}>
                {busy ? '参加しています…' : '参加する'}
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}
