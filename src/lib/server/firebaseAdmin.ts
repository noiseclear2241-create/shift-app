// サーバー専用：Firebase を「管理者」として操作するための準備。
// 秘密鍵（サービスアカウント）は Vercel の環境変数 FIREBASE_SERVICE_ACCOUNT に「シークレット」として登録する。
// ⚠️ このファイルは画面（ブラウザ）側から読み込まないこと。

import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';

/** 秘密鍵の JSON（そのまま、または base64 にしたもの）を読む。未設定なら null */
function readServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (!raw) return null;
  const json = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
  const sa = JSON.parse(json) as { project_id: string; client_email: string; private_key: string };
  return {
    projectId: sa.project_id,
    clientEmail: sa.client_email,
    // 環境変数に入れたときに改行が「\n」という文字になる場合があるので元に戻す
    privateKey: sa.private_key.replace(/\\n/g, '\n'),
  };
}

export function getAdminApp(): App | null {
  if (getApps().length) return getApps()[0];
  // 開発用：テスト用データベース（エミュレーター）で動かすときは、秘密鍵なしで使える
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    return initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'demo-shift' });
  }
  const sa = readServiceAccount();
  if (!sa) return null;
  return initializeApp({ credential: cert(sa) });
}
