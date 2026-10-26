// データの保存先を切り替える層。
// 画面側は Store の関数だけを使うので、保存先が Firestore でもブラウザ内でも同じ書き方になる。

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  updateDoc,
  type Firestore,
} from 'firebase/firestore';
import { DEFAULT_NOTIFICATION_PREFS, type CollectionName, type NotificationPrefs } from './types';

type Data = Record<string, unknown>;

export interface Store {
  mode: 'firebase' | 'local';
  subscribe<T>(col: CollectionName, cb: (items: T[]) => void, onError: (e: Error) => void): () => void;
  add(col: CollectionName, data: Data): Promise<string>;
  update(col: CollectionName, id: string, patch: Data): Promise<void>;
  remove(col: CollectionName, id: string): Promise<void>;
  /** 通知設定（ユーザーごと）。未保存なら初期値を返す */
  getPrefs(): Promise<NotificationPrefs>;
  savePrefs(prefs: NotificationPrefs): Promise<void>;
}

const withDefaults = (saved: Partial<NotificationPrefs> | undefined): NotificationPrefs => ({
  ...DEFAULT_NOTIFICATION_PREFS,
  ...saved,
});

/** 利用者の端末のタイムゾーン（サーバーから通知を送るときに「今日」を正しく判定するため保存する） */
const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tokyo';

/**
 * Firestore に保存する。データは workspaces/{workspaceId}/{events|shifts|tasks|deadlines} に入る。
 * workspace（作業スペース）単位で分けておくことで、将来チーム・企業での共有に広げられる。
 * 通知設定は人ごとの設定なので users/{uid} に置く。
 */
export function createFirestoreStore(db: Firestore, workspaceId: string, uid: string): Store {
  const col = (name: CollectionName) => collection(db, 'workspaces', workspaceId, name);
  const userRef = doc(db, 'users', uid);
  return {
    mode: 'firebase',
    subscribe(name, cb, onError) {
      return onSnapshot(
        col(name),
        (snap) => cb(snap.docs.map((d) => ({ ...d.data(), id: d.id }) as never)),
        onError,
      );
    },
    async add(name, data) {
      const now = Date.now();
      const ref = await addDoc(col(name), { ...data, createdAt: now, updatedAt: now });
      return ref.id;
    },
    async update(name, id, patch) {
      await updateDoc(doc(col(name), id), { ...patch, updatedAt: Date.now() });
    },
    async remove(name, id) {
      await deleteDoc(doc(col(name), id));
    },
    async getPrefs() {
      const snap = await getDoc(userRef);
      return withDefaults(snap.data()?.notifications);
    },
    async savePrefs(prefs) {
      await setDoc(
        userRef,
        { notifications: prefs, timezone: deviceTimeZone(), workspaceId, updatedAt: Date.now() },
        { merge: true },
      );
    },
  };
}

/**
 * お試しモード：このブラウザの localStorage にだけ保存する。
 * Firebase 未設定でも画面を使って確かめられるようにするためのもので、他の端末とは共有されない。
 */
export function createLocalStore(): Store {
  const key = (name: CollectionName) => `shiftapp:v1:${name}`;
  const listeners = new Map<CollectionName, Set<(items: unknown[]) => void>>();

  const read = (name: CollectionName): Data[] => {
    try {
      return JSON.parse(localStorage.getItem(key(name)) || '[]');
    } catch {
      return [];
    }
  };
  const write = (name: CollectionName, items: Data[]) => {
    localStorage.setItem(key(name), JSON.stringify(items));
    listeners.get(name)?.forEach((l) => l(items));
  };

  return {
    mode: 'local',
    subscribe(name, cb) {
      const set = listeners.get(name) ?? new Set();
      listeners.set(name, set);
      const l = cb as (items: unknown[]) => void;
      set.add(l);
      // 別タブでの変更も反映する
      const onStorage = (e: StorageEvent) => e.key === key(name) && l(read(name));
      window.addEventListener('storage', onStorage);
      queueMicrotask(() => l(read(name)));
      return () => {
        set.delete(l);
        window.removeEventListener('storage', onStorage);
      };
    },
    async add(name, data) {
      const id = crypto.randomUUID();
      const now = Date.now();
      write(name, [...read(name), { ...data, id, createdAt: now, updatedAt: now }]);
      return id;
    },
    async update(name, id, patch) {
      write(
        name,
        read(name).map((item) => (item.id === id ? { ...item, ...patch, updatedAt: Date.now() } : item)),
      );
    },
    async remove(name, id) {
      write(
        name,
        read(name).filter((item) => item.id !== id),
      );
    },
    async getPrefs() {
      try {
        return withDefaults(JSON.parse(localStorage.getItem('shiftapp:v1:prefs') || '{}'));
      } catch {
        return withDefaults(undefined);
      }
    },
    async savePrefs(prefs) {
      localStorage.setItem('shiftapp:v1:prefs', JSON.stringify(prefs));
    },
  };
}
