'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signOut as fbSignOut, type User } from 'firebase/auth';
import { collection, doc, getDoc, onSnapshot, query, setDoc, where } from 'firebase/firestore';
import { callApi } from '@/lib/api';
import { getFirebase, isFirebaseConfigured } from '@/lib/firebase';
import { refreshPush } from '@/lib/push';
import type { Viewer } from '@/lib/schedule';
import { createFirestoreStore, createLocalStore, type Store } from '@/lib/store';
import type { Role, Workspace } from '@/lib/types';

type Status = 'loading' | 'signedOut' | 'ready' | 'error';

interface AppState {
  status: Status;
  error: string;
  uid: string;
  userName: string;
  store: Store | null;
  /** 今見ている作業スペース（個人用またはチーム） */
  workspace: Workspace | null;
  /** 自分が入っている作業スペースすべて（個人用が先頭） */
  workspaces: Workspace[];
  role: Role;
  /** オーナーまたは管理者（催事・出勤・期限を登録・編集できる） */
  isManager: boolean;
  viewer: Viewer;
  switchWorkspace: (id: string) => void;
  signOut: () => Promise<void>;
}

const AppContext = createContext<AppState | null>(null);

const LOCAL_WORKSPACE: Workspace = {
  id: 'local',
  name: 'お試しモード',
  type: 'personal',
  ownerId: 'local',
  members: { local: 'owner' },
  memberUids: ['local'],
  plan: 'free',
};

const currentKey = (uid: string) => `shiftapp:workspace:${uid}`;

/**
 * 初回ログイン時に、その人専用の作業スペースを作る。
 * 既にある場合は何もしない（既存データを上書きしない）。
 */
async function ensurePersonalWorkspace(user: User) {
  const { db } = getFirebase();
  const ref = doc(db, 'workspaces', user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  await setDoc(ref, {
    name: '個人用',
    type: 'personal',
    ownerId: user.uid,
    members: { [user.uid]: 'owner' },
    memberUids: [user.uid],
    plan: 'free',
    createdAt: Date.now(),
  });
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentId, setCurrentId] = useState('');

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setWorkspaces([LOCAL_WORKSPACE]);
      setCurrentId('local');
      setStatus('ready');
      return;
    }
    const { auth, db } = getFirebase();
    let stopLists: (() => void)[] = [];
    const stopAll = () => {
      stopLists.forEach((s) => s());
      stopLists = [];
    };

    const stopAuth = onAuthStateChanged(auth, async (u) => {
      stopAll();
      setUser(u);
      if (!u) {
        setWorkspaces([]);
        setStatus('signedOut');
        return;
      }
      // ログイン直後〜作業スペースの準備が終わるまでは「読み込み中」にする
      setStatus('loading');
      try {
        await ensurePersonalWorkspace(u);
        // 古い個人用スペースの形を最新にし、チームでの表示名を更新する（失敗しても使えるようにする）
        await callApi('/api/workspaces/sync').catch((e) => console.warn('スペースの同期に失敗', e));

        setCurrentId(localStorage.getItem(currentKey(u.uid)) || u.uid);

        // 個人用スペースと、自分が入っているチームを読み込み続ける（メンバーの追加・削除もすぐ反映）
        let personal: Workspace | null = null;
        let teams: Workspace[] = [];
        const publish = () => {
          const list = [personal, ...teams.filter((t) => t.id !== u.uid)].filter((w): w is Workspace => !!w);
          setWorkspaces(list);
          if (personal) setStatus('ready');
        };
        stopLists.push(
          onSnapshot(doc(db, 'workspaces', u.uid), (snap) => {
            personal = snap.exists() ? ({ ...snap.data(), id: snap.id } as Workspace) : null;
            publish();
          }),
          onSnapshot(
            query(collection(db, 'workspaces'), where('memberUids', 'array-contains', u.uid)),
            (snap) => {
              teams = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Workspace);
              publish();
            },
            (e) => console.warn('チーム一覧の読み込みに失敗', e),
          ),
        );

        // 通知を登録済みの端末なら、通知用トークンを最新にしておく（失敗しても画面には影響させない）
        refreshPush(u.uid).catch((e) => console.warn('通知トークンの更新に失敗', e));
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
    return () => {
      stopAll();
      stopAuth();
    };
  }, []);

  const uid = isFirebaseConfigured ? user?.uid ?? '' : 'local';
  // 選んでいたチームから外された場合などは、個人用スペースに戻す
  const workspace = workspaces.find((w) => w.id === currentId) ?? workspaces[0] ?? null;
  const workspaceId = workspace?.id ?? '';

  const store = useMemo<Store | null>(() => {
    if (!isFirebaseConfigured) return createLocalStore();
    if (!uid || !workspaceId) return null;
    return createFirestoreStore(getFirebase().db, workspaceId, uid);
  }, [uid, workspaceId]);

  const switchWorkspace = useCallback(
    (id: string) => {
      setCurrentId(id);
      try {
        localStorage.setItem(currentKey(uid), id);
      } catch {
        // 保存できなくても切り替え自体はできる
      }
    },
    [uid],
  );

  const value = useMemo<AppState>(() => {
    const role: Role = workspace?.members?.[uid] ?? 'staff';
    return {
      status,
      error,
      store,
      uid,
      userName: isFirebaseConfigured ? user?.displayName || user?.email || '' : 'お試しモード',
      workspace,
      workspaces,
      role,
      isManager: role === 'owner' || role === 'admin',
      viewer: { uid, personal: workspace?.type !== 'team' },
      switchWorkspace,
      signOut: async () => {
        if (isFirebaseConfigured) await fbSignOut(getFirebase().auth);
      },
    };
  }, [status, error, store, uid, user, workspace, workspaces, switchWorkspace]);

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
