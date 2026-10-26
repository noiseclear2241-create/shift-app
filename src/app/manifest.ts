import type { MetadataRoute } from 'next';

// 「ホーム画面に追加」したときのアプリ名・アイコン・表示方法
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'シフト手帳',
    short_name: 'シフト手帳',
    description: '催事の出勤予定・今日の予定・タスクをまとめて確認できるシフト管理アプリ',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f4f5f7',
    theme_color: '#ffffff',
    lang: 'ja',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
