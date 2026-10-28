import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';

/** 開発用：パソコン上のテスト用データベース（エミュレーター）につなぐ。本番では使わない */
const useEmulator = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === '1';

// NEXT_PUBLIC_ の値はビルド時に埋め込まれる。Firebase のWeb用設定値は公開前提の値で、
// データの保護は Firestore のセキュリティルール（firestore.rules）で行う。
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(config.apiKey && config.projectId && config.appId);

let cached: { app: FirebaseApp; auth: Auth; db: Firestore } | null = null;

export function getFirebase() {
  if (!isFirebaseConfigured) throw new Error('Firebase の設定がありません');
  if (!cached) {
    const app = getApps().length ? getApp() : initializeApp(config);
    cached = { app, auth: getAuth(app), db: getFirestore(app) };
    if (useEmulator) {
      connectAuthEmulator(cached.auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      connectFirestoreEmulator(cached.db, '127.0.0.1', 8080);
    }
  }
  return cached;
}
