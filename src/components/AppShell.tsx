'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useApp } from './AppProvider';
import { Icon, type IconName } from './Icon';

const NAV: { href: string; label: string; icon: IconName }[] = [
  { href: '/', label: 'ホーム', icon: 'home' },
  { href: '/calendar', label: 'カレンダー', icon: 'calendar' },
  { href: '/shifts', label: '出勤', icon: 'briefcase' },
  { href: '/tasks', label: 'タスク', icon: 'check' },
  { href: '/events', label: '催事', icon: 'flag' },
];

const isActive = (path: string, href: string) => (href === '/' ? path === '/' : path.startsWith(href));

export function AppShell({ children }: { children: ReactNode }) {
  const { status, error, userName, store, signOut } = useApp();
  const path = usePathname();
  const router = useRouter();
  const onLogin = path === '/login';

  useEffect(() => {
    if (status === 'signedOut' && !onLogin) router.replace('/login');
    if (status === 'ready' && onLogin) router.replace('/');
  }, [status, onLogin, router]);

  if (onLogin) return <main className="login-main">{children}</main>;

  if (status === 'error') {
    return (
      <main className="center-msg">
        <p>データの準備中にエラーが発生しました。</p>
        <p className="muted small">{error}</p>
      </main>
    );
  }
  if (status !== 'ready' || !store) {
    return <main className="center-msg muted">読み込み中…</main>;
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">シフト手帳</div>
        <nav>
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={`side-link ${isActive(path, n.href) ? 'active' : ''}`}>
              <Icon name={n.icon} />
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="small muted">{userName}</div>
          {store.mode === 'firebase' && (
            <button className="btn-link small" onClick={signOut}>
              ログアウト
            </button>
          )}
        </div>
      </aside>

      <div className="content">
        <header className="topbar">
          <span className="brand">シフト手帳</span>
          {store.mode === 'firebase' && (
            <button className="btn-link small" onClick={signOut}>
              ログアウト
            </button>
          )}
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
