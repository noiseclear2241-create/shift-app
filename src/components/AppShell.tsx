'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useApp } from './AppProvider';
import { Icon, type IconName } from './Icon';
import { PUBLIC_PATHS } from '@/lib/site';

const NAV: { href: string; label: string; icon: IconName }[] = [
  { href: '/', label: 'ホーム', icon: 'home' },
  { href: '/calendar', label: 'カレンダー', icon: 'calendar' },
  { href: '/shifts', label: '出勤', icon: 'briefcase' },
  { href: '/tasks', label: 'タスク', icon: 'check' },
  { href: '/events', label: '催事', icon: 'flag' },
];

const isActive = (path: string, href: string) => (href === '/' ? path === '/' : path.startsWith(href));

/** ログイン後に戻る画面（招待リンクから来た場合など）。アプリ内の画面だけ許可する */
function nextPath() {
  const next = new URLSearchParams(window.location.search).get('next') ?? '';
  return next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

/** 画面上部・サイドバーに出す、今見ている作業スペースの名前 */
export function workspaceLabel(w: { type: string; name: string } | null) {
  if (!w) return '';
  return w.type === 'team' ? w.name : '個人用';
}

export function AppShell({ children }: { children: ReactNode }) {
  const { status, error, userName, store, signOut, workspace } = useApp();
  const path = usePathname();
  const router = useRouter();
  const onLogin = path === '/login';
  const isPublic = PUBLIC_PATHS.includes(path);

  useEffect(() => {
    if (isPublic) return;
    if (status === 'signedOut' && !onLogin) router.replace(`/login?next=${encodeURIComponent(path)}`);
    if (status === 'ready' && onLogin) router.replace(nextPath());
  }, [status, onLogin, isPublic, router, path]);

  // 紹介ページなどは、ログインしていなくてもそのまま表示する（広告会社の審査・初めての人向け）
  if (isPublic) return <>{children}</>;

  // ログイン後の準備で失敗した場合は、ログイン画面でもエラーを表示する（何も起きないように見えるのを防ぐ）
  if (status === 'error') {
    return (
      <main className="center-msg">
        <p>ログイン後のデータの準備でエラーが発生しました。</p>
        <p className="muted small">{error}</p>
        <button className="btn btn-outline" onClick={signOut}>
          ログアウトしてやり直す
        </button>
      </main>
    );
  }

  if (onLogin) {
    if (status === 'loading' || status === 'ready') return <main className="center-msg muted">読み込み中…</main>;
    return <main className="login-main">{children}</main>;
  }
  if (status !== 'ready' || !store) {
    return <main className="center-msg muted">読み込み中…</main>;
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">シフト手帳</div>
        <Link href="/team" className={`ws-chip ${workspace?.type === 'team' ? 'is-team' : ''}`}>
          <Icon name="user" size={16} />
          <span>{workspaceLabel(workspace)}</span>
          <span className="small">切り替え</span>
        </Link>
        <nav>
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={`side-link ${isActive(path, n.href) ? 'active' : ''}`}>
              <Icon name={n.icon} />
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-foot">
          <Link href="/settings" className={`side-link ${isActive(path, '/settings') ? 'active' : ''}`}>
            <Icon name="gear" />
            設定
          </Link>
          <div className="small muted" style={{ padding: '0 12px' }}>
            {userName}
          </div>
        </div>
      </aside>

      <div className="content">
        <header className="topbar">
          <Link href="/team" className={`ws-chip ${workspace?.type === 'team' ? 'is-team' : ''}`} aria-label="チームの切り替え">
            <Icon name="user" size={16} />
            <span>{workspaceLabel(workspace)}</span>
            <Icon name="chevron" size={14} />
          </Link>
          <Link href="/settings" className="topbar-link" aria-label="設定">
            <Icon name="gear" />
            設定
          </Link>
        </header>
        {store.mode === 'local' && (
          <div className="trial-banner">
            お試しモード：データはこのブラウザの中だけに保存されます（Firebase 未設定）
          </div>
        )}
        <main className="page">{children}</main>
      </div>

      <nav className="bottom-nav">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={isActive(path, n.href) ? 'active' : ''}>
            <Icon name={n.icon} />
            <span>{n.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
