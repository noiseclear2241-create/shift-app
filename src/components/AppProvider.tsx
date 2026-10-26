'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signOut as fbSignOut, type User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getFirebase, isFirebaseConfigured } from '@/lib/firebase';
import { createFirestoreStore, createLocalStore, type Store } from '@/lib/store';

type Status = 'loading' | 'signedOut' | 'ready' | 'error';

interface AppState {
  status: Status;
  error: string;
  userName: string;
  store: Store | null;
  signOut: () => Promise<void>;
}

const AppContext = createContext<AppState | null>(null);

/**
 * 初回ログイン時に、その人専用の作業スペースを作る。
 * 既にある場合は何もしない（既存データを上書きしない）。
 */
async function ensureWorkspace(user: User) {
  const { db } = getFirebase();
  const ref = doc(db, 'workspaces', user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  await setDoc(ref, {
    name: `${user.displayName || user.email || 'マイ'}のスペース`,
    type: 'personal',
    ownerId: user.uid,
    members: { [user.uid]: 'owner' },
    plan: 'free',
    createdAt: Date.now(),
  });
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [store, setStore] = useState<Store | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setStore(createLocalStore());
      setStatus('ready');
      return;
    }
    const { auth, db } = getFirebase();
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        setStore(null);
        setStatus('signedOut');
        return;
      }
      // ログイン直後〜作業スペースの準備が終わるまでは「読み込み中」にする
      setStatus('loading');
      try {
        await ensureWorkspace(u);
        setStore(createFirestoreStore(db, u.uid, u.uid));
        setStatus('ready');
      } catch (e) {
        const code = (e as { code?: string })?.code ?? '';
        const msg = e instanceof Error ? e.message : String(e);
        setError(
          code === 'permission-denied'
            ? `データベースへのアクセスが拒否されました。Firestore のルールが公開されているか確認してください。（${msg}）`
            : msg,
        );
        setStatus('error');
      }
    });
  }, []);

  const value = useMemo<AppState>(
    () => ({
      status,
      error,
      store,
      userName: isFirebaseConfigured ? user?.displayName || user?.email || '' : 'お試しモード',
      signOut: async () => {
        if (isFirebaseConfigured) await fbSignOut(getFirebase().auth);
      },
    }),
    [status, error, store, user],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('AppProvider の内側で使ってください');
  return ctx;
}

/** ログイン済みの画面でだけ使う（AppShell が ready のときだけ子画面を表示する） */
export function useStore(): Store {
  const { store } = useApp();
  if (!store) throw new Error('データの保存先が準備できていません');
  return store;
}
