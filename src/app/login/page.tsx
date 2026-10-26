'use client';

import { useState, type FormEvent } from 'react';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth';
import { getFirebase, isFirebaseConfigured } from '@/lib/firebase';

// Firebase のエラーコードを日本語に
const MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'メールアドレスまたはパスワードが違います',
  'auth/invalid-email': 'メールアドレスの形式が正しくありません',
  'auth/email-already-in-use': 'このメールアドレスは登録済みです。ログインしてください',
  'auth/weak-password': 'パスワードは6文字以上にしてください',
  'auth/too-many-requests': '試行回数が多すぎます。しばらく待ってからお試しください',
  'auth/popup-closed-by-user': 'ログインがキャンセルされました',
  'auth/operation-not-allowed': 'このログイン方法が有効になっていません（Firebase の Authentication で有効にしてください）',
  'auth/configuration-not-found': 'Firebase の Authentication がまだ開始されていません',
  'auth/unauthorized-domain': 'このドメインからのログインが許可されていません（Firebase の承認済みドメインに追加してください）',
};

const toMessage = (e: unknown) => {
  const code = (e as { code?: string })?.code ?? '';
  return MESSAGES[code] ?? `ログインできませんでした（${code || '不明なエラー'}）`;
};

export default function LoginPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!isFirebaseConfigured) {
    return (
      <div className="card login-card">
        <h1>シフト手帳</h1>
        <p>Firebase が未設定のため、ログインなしの「お試しモード」で動いています。</p>
        <a className="btn btn-primary" href="/">
          ホームへ
        </a>
      </div>
    );
  }

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(toMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const { auth } = getFirebase();
    run(() =>
      mode === 'signin'
        ? signInWithEmailAndPassword(auth, email, password)
        : createUserWithEmailAndPassword(auth, email, password),
    );
  };

  return (
    <div className="card login-card">
      <h1>シフト手帳</h1>
      <p className="muted">{mode === 'signin' ? 'ログイン' : '新規登録'}</p>

      <button
        className="btn btn-outline block"
        disabled={busy}
        onClick={() => run(() => signInWithPopup(getFirebase().auth, new GoogleAuthProvider()))}
      >
        Google でログイン
      </button>

      <div className="divider">または</div>

      <form onSubmit={submit} className="form">
        <label>
          メールアドレス
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          パスワード
          <input
            type="password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary block" disabled={busy}>
          {mode === 'signin' ? 'ログイン' : '登録する'}
        </button>
      </form>

      <button className="btn-link" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
        {mode === 'signin' ? 'はじめての方は新規登録' : 'アカウントをお持ちの方はログイン'}
      </button>
    </div>
  );
}
