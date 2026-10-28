'use client';

import { useState, type FormEvent } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { useApp } from '@/components/AppProvider';
import { workspaceLabel } from '@/components/AppShell';
import { callApi } from '@/lib/api';
import { getFirebase } from '@/lib/firebase';
import { ROLE_LABEL, type Role } from '@/lib/types';

export default function TeamPage() {
  const { workspace, workspaces, switchWorkspace, uid, isManager, role, store } = useApp();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState('');
  const [inviteRole, setInviteRole] = useState<'staff' | 'admin'>('staff');
  const [inviteUrl, setInviteUrl] = useState('');
  const [teamName, setTeamName] = useState<string | null>(null);

  const run = async (fn: () => Promise<string | void>) => {
    setBusy(true);
    setMessage(null);
    try {
      const text = await fn();
      if (text) setMessage({ ok: true, text });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  if (!workspace) return <p className="muted">読み込み中…</p>;
  const firebase = store?.mode === 'firebase';
  const isTeam = workspace.type === 'team';

  const createTeam = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      const { id } = await callApi<{ id: string }>('/api/workspaces', { body: { name: newName } });
      setNewName('');
      switchWorkspace(id);
      return `「${newName}」を作りました。下の「招待リンクを作る」からメンバーを招待できます。`;
    });
  };

  const createInvite = () =>
    run(async () => {
      const { code, expiresInDays } = await callApi<{ code: string; expiresInDays: number }>(
        `/api/workspaces/${workspace.id}/invites`,
        { body: { role: inviteRole } },
      );
      setInviteUrl(`${window.location.origin}/join/${code}`);
      return `招待リンクを作りました（${expiresInDays}日間有効）。LINE などで送ってください。`;
    });

  const shareInvite = async () => {
    const text = `シフト手帳「${workspace.name}」への招待です。リンクを開いてログインすると参加できます。`;
    try {
      if (navigator.share) await navigator.share({ title: 'シフト手帳への招待', text, url: inviteUrl });
      else {
        await navigator.clipboard.writeText(`${text}\n${inviteUrl}`);
        setMessage({ ok: true, text: 'リンクをコピーしました。LINE などに貼り付けて送ってください。' });
      }
    } catch {
      // 共有をキャンセルした場合など
    }
  };

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setMessage({ ok: true, text: 'リンクをコピーしました。' });
    } catch {
      setMessage({ ok: false, text: 'コピーできませんでした。リンクを長押ししてコピーしてください。' });
    }
  };

  const changeRole = (target: string, next: Role) =>
    run(async () => {
      await callApi(`/api/workspaces/${workspace.id}/members/${target}`, { method: 'PATCH', body: { role: next } });
      return '役割を変更しました。';
    });

  const removeMember = (target: string, name: string) => {
    const self = target === uid;
    if (!confirm(self ? `「${workspace.name}」から抜けますか？` : `${name} さんをチームから外しますか？`)) return;
    run(async () => {
      await callApi(`/api/workspaces/${workspace.id}/members/${target}`, { method: 'DELETE' });
      if (self) switchWorkspace(uid);
      return self ? 'チームから抜けました。' : `${name} さんをチームから外しました。`;
    });
  };

  const saveTeamName = (e: FormEvent) => {
    e.preventDefault();
    const name = (teamName ?? '').trim();
    if (!name) return;
    run(async () => {
      await updateDoc(doc(getFirebase().db, 'workspaces', workspace.id), { name });
      setTeamName(null);
      return 'チーム名を変更しました。';
    });
  };

  const members = Object.entries(workspace.members ?? {}).sort(([, a], [, b]) => roleOrder(a) - roleOrder(b));

  return (
    <div className="stack">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <h1>チーム</h1>
      </div>

      {message && (
        <p className={message.ok ? 'ok-msg' : 'error'} style={{ margin: 0 }} aria-live="polite">
          {message.text}
        </p>
      )}

      <section className="card stack">
        <h2>表示するスペース</h2>
        <p className="small muted" style={{ margin: 0 }}>
          「個人用」は自分だけのデータです。チームを選ぶと、そのチームの催事・出勤・タスクが表示されます。
        </p>
        <ul className="task-list">
          {workspaces.map((w) => (
            <li key={w.id} className="task-item">
              <label className="switch-row" style={{ flex: 1, padding: 0 }}>
                <span>
                  <span className="switch-label">{workspaceLabel(w)}</span>
                  <span className="small muted">
                    {w.type === 'team'
                      ? `チーム・${ROLE_LABEL[w.members?.[uid] ?? 'staff']}・メンバー${Object.keys(w.members ?? {}).length}人`
                      : '自分だけ'}
                  </span>
                </span>
                <input
                  type="radio"
                  name="workspace"
                  checked={w.id === workspace.id}
                  onChange={() => switchWorkspace(w.id)}
                  style={{ width: 22, height: 22 }}
                />
              </label>
            </li>
          ))}
        </ul>
      </section>

      {firebase && (
        <section className="card">
          <h2 style={{ marginBottom: 12 }}>新しいチームを作る</h2>
          <form className="form" onSubmit={createTeam}>
            <label>
              チーム名・会社名
              <input value={newName} onChange={(e) => setNewName(e.target.value)} required maxLength={40} placeholder="例：〇〇販売 催事チーム" />
              <span className="hint">作った人が「オーナー」になります。</span>
            </label>
            <button className="btn btn-primary" disabled={busy || !newName.trim()}>
              チームを作る
            </button>
          </form>
        </section>
      )}

      {isTeam && (
        <section className="card stack">
          <div className="section-head" style={{ marginBottom: 0 }}>
            <h2>{workspace.name} のメンバー</h2>
            <span className="small muted">あなた：{ROLE_LABEL[role]}</span>
          </div>

          {isManager && teamName === null && (
            <button className="btn-link small" style={{ alignSelf: 'flex-start' }} onClick={() => setTeamName(workspace.name)}>
              チーム名を変更
            </button>
          )}
          {teamName !== null && (
            <form className="form" onSubmit={saveTeamName}>
              <input value={teamName} onChange={(e) => setTeamName(e.target.value)} maxLength={40} required />
              <div className="form-actions">
                <button type="button" className="btn btn-outline" onClick={() => setTeamName(null)}>
                  やめる
                </button>
                <button className="btn btn-primary" disabled={busy}>
                  保存
                </button>
              </div>
            </form>
          )}

          <ul className="task-list">
            {members.map(([memberUid, memberRole]) => {
              const name = workspace.memberNames?.[memberUid] || 'メンバー';
              const canEdit = isManager && memberRole !== 'owner' && memberUid !== uid;
              return (
                <li key={memberUid} className="task-item">
                  <div className="grow">
                    <div className="title">
                      {name}
                      {memberUid === uid && <span className="small muted">（あなた）</span>}
                    </div>
                    {!canEdit && <div className="small muted">{ROLE_LABEL[memberRole]}</div>}
                  </div>
                  {canEdit && (
                    <select
                      value={memberRole}
                      disabled={busy}
                      onChange={(e) => changeRole(memberUid, e.target.value as Role)}
                      aria-label={`${name} さんの役割`}
                      className="role-select"
                    >
                      <option value="admin">管理者</option>
                      <option value="staff">スタッフ</option>
                    </select>
                  )}
                  {(canEdit || (memberUid === uid && memberRole !== 'owner')) && (
                    <button className="btn-link small" style={{ color: 'var(--danger)' }} disabled={busy} onClick={() => removeMember(memberUid, name)}>
                      {memberUid === uid ? '抜ける' : '外す'}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>

          <details className="next-more">
            <summary>役割でできること</summary>
            <ul className="small" style={{ margin: 0, paddingLeft: '1.2em' }}>
              <li>オーナー：すべての操作。チームから外されることはありません</li>
              <li>管理者：催事・出勤・提出期限・シフト希望の受付の登録と編集、メンバーの招待と役割の変更</li>
              <li>スタッフ：チームの予定を見る、自分のタスクの管理、シフト希望の提出</li>
            </ul>
          </details>

          {isManager && (
            <div className="notice-box stack" style={{ gap: 10 }}>
              <b>招待リンクを作る</b>
              <div className="choice" role="radiogroup" aria-label="招待する役割">
                {(['staff', 'admin'] as const).map((r) => (
                  <button key={r} type="button" role="radio" aria-checked={inviteRole === r} className={inviteRole === r ? 'active' : ''} onClick={() => setInviteRole(r)}>
                    {ROLE_LABEL[r]}として招待
                  </button>
                ))}
              </div>
              <button className="btn btn-primary" disabled={busy} onClick={createInvite}>
                招待リンクを作る
              </button>
              {inviteUrl && (
                <>
                  <input className="invite-url" readOnly value={inviteUrl} onFocus={(e) => e.target.select()} aria-label="招待リンク" />
                  <div className="form-actions">
                    <button className="btn btn-outline" onClick={copyInvite}>
                      コピー
                    </button>
                    <button className="btn btn-primary" onClick={shareInvite}>
                      LINE などで送る
                    </button>
                  </div>
                  <p className="small muted" style={{ margin: 0 }}>
                    7日間・50人まで使えます。リンクを知っている人は誰でも参加できるので、チームの人にだけ送ってください。
                  </p>
                </>
              )}
            </div>
          )}
        </section>
      )}

      {!firebase && <p className="small muted">チーム機能は、Firebase に接続した公開版で使えます。</p>}
    </div>
  );
}

const roleOrder = (r: Role) => (r === 'owner' ? 0 : r === 'admin' ? 1 : 2);
