/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Google ログインの画面を、このアプリと同じアドレス（/__/auth/...）で表示するための中継。
  // iPhone などは「別のサイトの保存領域」を使えないため、firebaseapp.com のままだと
  // 「初期状態が欠落しているため…」のエラーになる。同じアドレスにすると解消する。
  // （Firebase 公式の対処法「認証リクエストを firebaseapp.com にプロキシする」）
  async rewrites() {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    if (!projectId) return [];
    return [{ source: '/__/auth/:path*', destination: `https://${projectId}.firebaseapp.com/__/auth/:path*` }];
  },
};

export default nextConfig;
