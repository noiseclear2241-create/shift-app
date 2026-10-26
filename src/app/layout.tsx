import type { Metadata, Viewport } from 'next';
import { AppProvider } from '@/components/AppProvider';
import { AppShell } from '@/components/AppShell';
import './globals.css';

export const metadata: Metadata = {
  title: 'シフト手帳',
  description: '催事の出勤予定・今日の予定・タスクをまとめて確認できるシフト管理アプリ',
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/apple-touch-icon.png',
  },
  // iPhone で「ホーム画面に追加」したときにアプリとして開く設定
  appleWebApp: {
    capable: true,
    title: 'シフト手帳',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#ffffff',
  viewportFit: 'cover', // iPhone の画面下の余白（safe-area）を正しく扱う
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <AppProvider>
          <AppShell>{children}</AppShell>
        </AppProvider>
      </body>
    </html>
  );
}
