// Firestore のルール（firestore.rules）のテスト。
// 本物のデータベースは使わず、パソコン上の「テスト用データベース（エミュレーター）」で確かめる。
// 実行：npm run test:rules
import { after, before, beforeEach, describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';

let env;

const OWNER = 'owner1';
const ADMIN = 'admin1';
const STAFF = 'staff1';
const OUTSIDER = 'outsider1';
const TEAM = 'team1';

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-shift',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

after(async () => {
  await env.cleanup();
});

// 毎回、チームと受付中・締め切り済みのシフト希望をルールを無視して用意する
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'workspaces', TEAM), {
      name: 'テストチーム',
      type: 'team',
      ownerId: OWNER,
      plan: 'free',
      members: { [OWNER]: 'owner', [ADMIN]: 'admin', [STAFF]: 'staff' },
      memberUids: [OWNER, ADMIN, STAFF],
    });
    await setDoc(doc(db, 'workspaces', TEAM, 'shifts', 's1'), { date: '2026-11-01', assigneeUid: STAFF });
    await setDoc(doc(db, 'workspaces', TEAM, 'tasks', 'mine'), { title: 'a', assigneeUid: STAFF });
    await setDoc(doc(db, 'workspaces', TEAM, 'tasks', 'others'), { title: 'b', assigneeUid: ADMIN });
    await setDoc(doc(db, 'workspaces', TEAM, 'availabilityPeriods', 'open1'), { status: 'open' });
    await setDoc(doc(db, 'workspaces', TEAM, 'availabilityPeriods', 'closed1'), { status: 'closed' });
    await setDoc(doc(db, 'workspaces', TEAM, 'availability', `open1_${ADMIN}`), { periodId: 'open1', uid: ADMIN, days: {} });
  });
});

const as = (uid) => env.authenticatedContext(uid).firestore();

describe('個人用スペース', () => {
  const personal = (uid, extra = {}) => ({
    name: 'x', type: 'personal', ownerId: uid, plan: 'free', members: { [uid]: 'owner' }, memberUids: [uid], ...extra,
  });

  test('自分専用のスペースは作れる', async () => {
    await assertSucceeds(setDoc(doc(as('u1'), 'workspaces', 'u1'), personal('u1')));
  });
  test('他人のIDのスペースは作れない', async () => {
    await assertFails(setDoc(doc(as('u1'), 'workspaces', 'u2'), personal('u2')));
  });
  test('他人をメンバーに入れて作ることはできない', async () => {
    await assertFails(
      setDoc(doc(as('u1'), 'workspaces', 'u1'), personal('u1', { members: { u1: 'owner', u2: 'admin' } })),
    );
  });
  test('有料プランで作ることはできない', async () => {
    await assertFails(setDoc(doc(as('u1'), 'workspaces', 'u1'), personal('u1', { plan: 'pro' })));
  });
  test('画面からチームを作ることはできない（サーバーのみ）', async () => {
    await assertFails(setDoc(doc(as('u1'), 'workspaces', 'u1'), personal('u1', { type: 'team' })));
  });
  test('まだ無い自分専用スペースは確認できる', async () => {
    await assertSucceeds(getDoc(doc(as('u9'), 'workspaces', 'u9')));
  });
});

describe('チームの読み取り', () => {
  test('メンバーはチームと出勤を見られる', async () => {
    await assertSucceeds(getDoc(doc(as(STAFF), 'workspaces', TEAM)));
    await assertSucceeds(getDocs(collection(as(STAFF), 'workspaces', TEAM, 'shifts')));
  });
  test('メンバー以外は見られない', async () => {
    await assertFails(getDoc(doc(as(OUTSIDER), 'workspaces', TEAM)));
    await assertFails(getDocs(collection(as(OUTSIDER), 'workspaces', TEAM, 'shifts')));
  });
  test('自分が入っているスペースの一覧を読める', async () => {
    const q = query(collection(as(STAFF), 'workspaces'), where('memberUids', 'array-contains', STAFF));
    await assertSucceeds(getDocs(q));
  });
  test('ログインしていない人は何も読めない', async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'workspaces', TEAM)));
  });
});

describe('チームの変更', () => {
  test('スタッフはメンバーや役割を変えられない', async () => {
    await assertFails(updateDoc(doc(as(STAFF), 'workspaces', TEAM), { [`members.${STAFF}`]: 'owner' }));
  });
  test('管理者でもメンバーやプランは画面から変えられない', async () => {
    await assertFails(updateDoc(doc(as(ADMIN), 'workspaces', TEAM), { [`members.${OUTSIDER}`]: 'staff' }));
    await assertFails(updateDoc(doc(as(OWNER), 'workspaces', TEAM), { plan: 'pro' }));
  });
  test('管理者はチーム名を変えられる。スタッフは変えられない', async () => {
    await assertSucceeds(updateDoc(doc(as(ADMIN), 'workspaces', TEAM), { name: '新しい名前' }));
    await assertFails(updateDoc(doc(as(STAFF), 'workspaces', TEAM), { name: '勝手な名前' }));
  });
  test('チームは画面から削除できない', async () => {
    await assertFails(deleteDoc(doc(as(OWNER), 'workspaces', TEAM)));
  });
});

describe('催事・出勤・提出期限', () => {
  for (const col of ['events', 'shifts', 'deadlines']) {
    test(`${col}：オーナーと管理者は登録できる`, async () => {
      await assertSucceeds(setDoc(doc(as(OWNER), 'workspaces', TEAM, col, 'n1'), { a: 1 }));
      await assertSucceeds(setDoc(doc(as(ADMIN), 'workspaces', TEAM, col, 'n2'), { a: 1 }));
    });
    test(`${col}：スタッフとメンバー以外は登録できない`, async () => {
      await assertFails(setDoc(doc(as(STAFF), 'workspaces', TEAM, col, 'n3'), { a: 1 }));
      await assertFails(setDoc(doc(as(OUTSIDER), 'workspaces', TEAM, col, 'n4'), { a: 1 }));
    });
  }
  test('スタッフは自分の出勤でも書き換えられない', async () => {
    await assertFails(updateDoc(doc(as(STAFF), 'workspaces', TEAM, 'shifts', 's1'), { status: 'cancelled' }));
  });
});

describe('タスク', () => {
  test('スタッフは自分が担当のタスクを作れる', async () => {
    await assertSucceeds(setDoc(doc(as(STAFF), 'workspaces', TEAM, 'tasks', 't1'), { title: 'x', assigneeUid: STAFF }));
  });
  test('スタッフは他人が担当のタスクを作れない', async () => {
    await assertFails(setDoc(doc(as(STAFF), 'workspaces', TEAM, 'tasks', 't2'), { title: 'x', assigneeUid: ADMIN }));
  });
  test('スタッフは自分のタスクを完了にできるが、担当を他人に変えられない', async () => {
    await assertSucceeds(updateDoc(doc(as(STAFF), 'workspaces', TEAM, 'tasks', 'mine'), { status: 'done' }));
    await assertFails(updateDoc(doc(as(STAFF), 'workspaces', TEAM, 'tasks', 'mine'), { assigneeUid: ADMIN }));
  });
  test('スタッフは他人のタスクを変更・削除できない', async () => {
    await assertFails(updateDoc(doc(as(STAFF), 'workspaces', TEAM, 'tasks', 'others'), { status: 'done' }));
    await assertFails(deleteDoc(doc(as(STAFF), 'workspaces', TEAM, 'tasks', 'others')));
  });
  test('管理者は誰のタスクでも変更できる', async () => {
    await assertSucceeds(updateDoc(doc(as(ADMIN), 'workspaces', TEAM, 'tasks', 'mine'), { status: 'done' }));
  });
});

describe('シフト希望', () => {
  const answer = (periodId, uid) => ({ periodId, uid, days: { '2026-12-01': 'ok' }, note: '' });

  test('スタッフは受付中の期間に自分の希望を提出・修正できる', async () => {
    const ref = doc(as(STAFF), 'workspaces', TEAM, 'availability', `open1_${STAFF}`);
    await assertSucceeds(setDoc(ref, answer('open1', STAFF)));
    await assertSucceeds(updateDoc(ref, { note: '修正' }));
  });
  test('締め切った期間には提出できない', async () => {
    await assertFails(setDoc(doc(as(STAFF), 'workspaces', TEAM, 'availability', `closed1_${STAFF}`), answer('closed1', STAFF)));
  });
  test('他人になりすまして提出できない', async () => {
    await assertFails(setDoc(doc(as(STAFF), 'workspaces', TEAM, 'availability', `open1_${ADMIN}`), answer('open1', ADMIN)));
    await assertFails(setDoc(doc(as(STAFF), 'workspaces', TEAM, 'availability', `open1_${ADMIN}`), answer('open1', STAFF)));
  });
  test('スタッフは他人の希望を見られない。管理者は見られる', async () => {
    await assertFails(getDoc(doc(as(STAFF), 'workspaces', TEAM, 'availability', `open1_${ADMIN}`)));
    await assertSucceeds(getDoc(doc(as(OWNER), 'workspaces', TEAM, 'availability', `open1_${ADMIN}`)));
  });
  test('スタッフは受付（期間）を作れない', async () => {
    await assertFails(setDoc(doc(as(STAFF), 'workspaces', TEAM, 'availabilityPeriods', 'p9'), { status: 'open' }));
    await assertSucceeds(setDoc(doc(as(ADMIN), 'workspaces', TEAM, 'availabilityPeriods', 'p9'), { status: 'open' }));
  });
});

describe('ユーザー設定・サーバー専用のデータ', () => {
  test('自分の設定は読み書きできるが、他人の設定はできない', async () => {
    await assertSucceeds(setDoc(doc(as(STAFF), 'users', STAFF), { notifications: {} }));
    await assertFails(getDoc(doc(as(STAFF), 'users', ADMIN)));
    await assertFails(setDoc(doc(as(STAFF), 'users', ADMIN, 'devices', 'd1'), { token: 'x' }));
  });
  test('広告と、その表示・クリックの記録は画面から読み書きできない（サーバーのみ）', async () => {
    await assertFails(getDoc(doc(as(OWNER), 'ads', 'ad1')));
    await assertFails(setDoc(doc(as(OWNER), 'ads', 'ad1'), { title: 'x', linkUrl: 'https://evil.example' }));
    await assertFails(setDoc(doc(as(OWNER), 'ads', 'ad1', 'stats', '2026-10-28'), { clicks: 999 }));
  });
  test('招待と通知の送信記録は画面から読み書きできない', async () => {
    await assertFails(getDoc(doc(as(OWNER), 'invites', 'abc')));
    await assertFails(setDoc(doc(as(OWNER), 'invites', 'abc'), { workspaceId: TEAM, role: 'owner' }));
    await assertFails(getDoc(doc(as(OWNER), 'workspaces', TEAM, 'notificationLog', 'x')));
  });
});
