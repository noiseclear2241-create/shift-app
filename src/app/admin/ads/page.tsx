'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useApp } from '@/components/AppProvider';
import { AdCard } from '@/components/AdCard';
import { bannerShape, clickRate, parseAdCode } from '@/lib/ads';
import { callApi } from '@/lib/api';
import { formatPeriod } from '@/lib/schedule';
import type { Ad } from '@/lib/types';

type Stats = { impressions: number; clicks: number };
type AdRow = Ad & { recent: Stats; total: Stats; live: boolean };

const EMPTY = { title: '', description: '', imageUrl: '', linkUrl: '', weight: '10', startDate: '', endDate: '' };

/** 運営者だけが使う広告の管理画面 */
export default function AdminAdsPage() {
  const { store } = useApp();
  const [state, setState] = useState<'loading' | 'forbidden' | 'ready'>('loading');
  const [why, setWhy] = useState<{ email: string; reason: string } | null>(null);
  const [rows, setRows] = useState<AdRow[]>([]);
  const [statsDays, setStatsDays] = useState(30);
  const [editing, setEditing] = useState<string | null>(null); // null：閉じる / 'new' / 広告ID
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const [code, setCode] = useState('');
  const [codeNote, setCodeNote] = useState<{ ok: boolean; text: string } | null>(null);

  // 広告コードからリンク先URL・画像URL（テキスト広告ならタイトルも）を自動で入れる
  const readCode = () => {
    const r = parseAdCode(code);
    if ('error' in r) return setCodeNote({ ok: false, text: r.error });
    setF({ ...f, linkUrl: r.linkUrl, imageUrl: r.imageUrl, title: f.title || (r.imageUrl ? '' : r.text.slice(0, 60)) });
    const shape = bannerShape(r.width, r.height);
    const size = r.width && r.height ? `（${r.width}×${r.height}）` : '';
    setCodeNote({
      ok: shape !== 'tall',
      text: !r.imageUrl
        ? 'リンク先URLを入れました（文字だけの広告）。タイトルと説明を確認してください。'
        : shape === 'tall'
          ? `リンク先URLと画像URLを入れました。ただし、この画像は縦長${size}で、広告枠では小さくしか表示されません。正方形（300×250 など）か横長（468×60 など）のバナーを選び直すか、画像URLを消して文字だけの広告にするのがおすすめです。`
          : `リンク先URLと画像URL${size}を入れました。タイトル（広告の内容が分かる短い文）を入力してください。`,
    });
  };

  const load = useCallback(async () => {
    try {
      const r = await callApi<{ ads: AdRow[]; statsDays: number }>('/api/admin/ads', { method: 'GET' });
      setRows(r.ads);
      setStatsDays(r.statsDays);
      setState('ready');
    } catch {
      setState('forbidden');
      // 運営者として認められない理由を表示する（設定の確認用）
      callApi<{ email: string; reason: string }>('/api/admin/me', { method: 'GET' }).then(setWhy, () => {});
    }
  }, []);

  useEffect(() => {
    if (store?.mode === 'firebase') load();
    else setState('forbidden');
  }, [load, store?.mode]);

  const run = async (fn: () => Promise<string>) => {
    setBusy(true);
    setMessage(null);
    try {
      const text = await fn();
      await load();
      setMessage({ ok: true, text });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (ad?: AdRow) => {
    setMessage(null);
    setCode('');
    setCodeNote(null);
    setEditing(ad ? ad.id : 'new');
    setF(
      ad
        ? { title: ad.title, description: ad.description, imageUrl: ad.imageUrl, linkUrl: ad.linkUrl, weight: String(ad.weight), startDate: ad.startDate, endDate: ad.endDate }
        : EMPTY,
    );
  };

  const save = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      if (editing === 'new') await callApi('/api/admin/ads', { body: f });
      else await callApi(`/api/admin/ads/${editing}`, { method: 'PATCH', body: f });
      setEditing(null);
      return editing === 'new' ? '広告を追加しました（すぐに掲載が始まります）。' : '広告を変更しました。';
    });
  };

  const toggle = (ad: AdRow) =>
    run(async () => {
      const status = ad.status === 'active' ? 'paused' : 'active';
      await callApi(`/api/admin/ads/${ad.id}`, { method: 'PATCH', body: { status } });
      return status === 'active' ? '掲載を再開しました。' : '掲載を停止しました。';
    });

  const remove = (ad: AdRow) => {
    if (!confirm(`「${ad.title}」を削除しますか？表示・クリックの記録も消えます（元に戻せません）。`)) return;
    run(async () => {
      await callApi(`/api/admin/ads/${ad.id}`, { method: 'DELETE' });
      return '広告を削除しました。';
    });
  };

  if (state === 'loading') return <p className="muted">読み込み中…</p>;
  if (state === 'forbidden') {
    return (
      <div className="card">
        <h1 style={{ fontSize: '1.3rem' }}>広告の管理</h1>
        <p>この画面は運営者だけが使えます。</p>
        {why && (
          <div className="notice-box small">
            <div>ログイン中のメールアドレス：{why.email || '（なし）'}</div>
            {why.reason && <div style={{ marginTop: 4 }}>{why.reason}</div>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <h1>広告の管理</h1>
        {!editing && (
          <button className="btn btn-primary btn-sm" onClick={() => openEdit()}>
            広告を追加
          </button>
        )}
      </div>

      <div className="notice-box small">
        <b>掲載前の確認</b>
        <ul style={{ margin: '4px 0 0', paddingLeft: '1.2em' }}>
          <li>広告には自動で「PR」と表示されます（ステマ規制への対応）。広告であることを隠す文言にしないでください。</li>
          <li>アフィリエイトの「成果（購入・申込）」は、広告会社（ASP）の管理画面で確認してください。ここで数えるのは表示とクリックです。</li>
          <li>広告会社の規約（掲載してよい場所、自分でクリックしないこと など）を守ってください。</li>
          <li>表示されるのは、無料プランのスペースのホーム画面の下の方だけです。</li>
        </ul>
      </div>

      {message && (
        <p className={message.ok ? 'ok-msg' : 'error'} style={{ margin: 0 }} aria-live="polite">
          {message.text}
        </p>
      )}

      {editing && (
        <section className="card">
          <h2 style={{ marginBottom: 12 }}>{editing === 'new' ? '広告を追加' : '広告を編集'}</h2>
          <form className="form" onSubmit={save}>
            <div className="notice-box stack" style={{ gap: 8 }}>
              <label className="form" style={{ gap: 4 }}>
                <span style={{ fontWeight: 700 }}>広告コードを貼り付けて自動入力</span>
                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder={'A8.net・楽天などで発行された広告コード（<a href="...">〜</a>）をそのまま貼り付けます'}
                  rows={4}
                />
              </label>
              <button type="button" className="btn btn-outline" disabled={!code.trim()} onClick={readCode}>
                コードから読み取る
              </button>
              {codeNote && (
                <p className={codeNote.ok ? 'small' : 'error small'} style={{ margin: 0 }}>
                  {codeNote.text}
                </p>
              )}
            </div>
            <label>
              タイトル（必須）
              <input value={f.title} onChange={set('title')} maxLength={60} required placeholder="例：催事・イベントのお仕事探しなら〇〇" />
            </label>
            <label>
              説明
              <input value={f.description} onChange={set('description')} maxLength={120} placeholder="例：週1日からOKの求人が多数" />
            </label>
            <label>
              リンク先URL（必須）
              <input value={f.linkUrl} onChange={set('linkUrl')} required placeholder="https://px.a8.net/..." inputMode="url" />
              <span className="hint">広告会社で発行されたリンクのURL（https:// で始まるもの）を貼り付けます。HTMLのコードは使えません。</span>
            </label>
            <label>
              画像URL（任意）
              <input value={f.imageUrl} onChange={set('imageUrl')} placeholder="https://..." inputMode="url" />
              <span className="hint">バナー画像のURL。空なら文字だけの広告になります。</span>
            </label>
            <label>
              表示の割合（1〜100）
              <input type="number" min={1} max={100} value={f.weight} onChange={set('weight')} required />
              <span className="hint">掲載中の広告どうしで比べて、数字が大きいほどよく表示されます（例：30と10なら、3:1）。</span>
            </label>
            <div className="row">
              <label>
                掲載開始日
                <input type="date" value={f.startDate} onChange={set('startDate')} />
              </label>
              <label>
                掲載終了日
                <input type="date" value={f.endDate} min={f.startDate || undefined} onChange={set('endDate')} />
              </label>
            </div>
            <span className="hint">空なら、すぐに掲載が始まり、止めるまで続きます。</span>

            {f.title && (
              <div>
                <div className="small muted" style={{ marginBottom: 4 }}>
                  見本（ホーム画面ではこのように表示されます）
                </div>
                <AdCard key={f.imageUrl} title={f.title} description={f.description} imageUrl={f.imageUrl} />
              </div>
            )}

            <div className="form-actions">
              <button type="button" className="btn btn-outline" onClick={() => setEditing(null)}>
                キャンセル
              </button>
              <button className="btn btn-primary" disabled={busy}>
                {busy ? '保存中…' : '保存する'}
              </button>
            </div>
          </form>
        </section>
      )}

      {rows.length === 0 ? (
        <p className="empty-msg">広告はまだありません</p>
      ) : (
        <ul className="task-list">
          {rows.map((ad) => (
            <li key={ad.id} className="task-item" style={{ alignItems: 'flex-start' }}>
              <div className="grow">
                <div className="title">
                  {ad.title}
                  <span className={`badge ${ad.live ? 'badge-confirmed' : ad.status === 'paused' ? 'badge-cancelled' : 'badge-tentative'}`}>
                    {ad.live ? '掲載中' : ad.status === 'paused' ? '停止中' : '期間外'}
                  </span>
                </div>
                <div className="small muted">
                  割合 {ad.weight}
                  {(ad.startDate || ad.endDate) && ` ・ 期間 ${ad.startDate ? formatPeriod(ad.startDate, ad.endDate) : `〜${ad.endDate}`}`}
                </div>
                <div className="ad-stats">
                  <span>
                    直近{statsDays}日：表示 <b>{ad.recent.impressions}</b>・クリック <b>{ad.recent.clicks}</b>・クリック率{' '}
                    <b>{clickRate(ad.recent.impressions, ad.recent.clicks)}%</b>
                  </span>
                  <span className="muted">
                    合計：表示 {ad.total.impressions}・クリック {ad.total.clicks}
                  </span>
                </div>
                <div className="small muted" style={{ wordBreak: 'break-all' }}>
                  {ad.linkUrl}
                </div>
              </div>
              <div className="form-actions" style={{ flexDirection: 'column' }}>
                <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => openEdit(ad)}>
                  編集
                </button>
                <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => toggle(ad)}>
                  {ad.status === 'active' ? '停止' : '再開'}
                </button>
                <button className="btn-link small" style={{ color: 'var(--danger)' }} disabled={busy} onClick={() => remove(ad)}>
                  削除
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
