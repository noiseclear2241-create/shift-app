// サーバー専用：チームの作成・メンバーの追加や役割変更・招待。
// これらは画面から直接データベースを書き換えられないようにしてあり（firestore.rules）、ここでだけ行う。

import { randomBytes } from 'node:crypto';
import type { App } from 'firebase-admin/app';
import { FieldValue, getFirestore, type DocumentSnapshot, type Transaction } from 'firebase-admin/firestore';
import type { Role } from '../types';
import { ApiError } from './api';
import type { RequestUser } from './auth';

const INVITE_DAYS = 7;
const INVITE_MAX_USES = 50;
const MAX_TEAMS_PER_OWNER = 10;

const isManagerRole = (r: unknown) => r === 'owner' || r === 'admin';

/** 個人用スペースを最新の形にし、自分が入っている全スペースの表示名を更新する */
export async function syncWorkspaces(app: App, user: RequestUser) {
  const db = getFirestore(app);
  const personal = db.collection('workspaces').doc(user.uid);
  const snap = await personal.get();
  if (snap.exists && snap.get(`members.${user.uid}`) === 'owner') {
    await personal.update({
      type: 'personal',
      memberUids: [user.uid],
      [`memberNames.${user.uid}`]: user.name,
    });
  }
  const teams = await db.collection('workspaces').where('memberUids', 'array-contains', user.uid).get();
  await Promise.all(
    teams.docs
      .filter((d) => d.id !== user.uid && d.get(`memberNames.${user.uid}`) !== user.name)
      .map((d) => d.ref.update({ [`memberNames.${user.uid}`]: user.name })),
  );
}

export async function createTeam(app: App, user: RequestUser, name: string) {
  if (!name) throw new ApiError(400, 'チーム名を入力してください');
  const db = getFirestore(app);
  const owned = await db.collection('workspaces').where('ownerId', '==', user.uid).where('type', '==', 'team').count().get();
  if (owned.data().count >= MAX_TEAMS_PER_OWNER) {
    throw new ApiError(400, `作れるチームは${MAX_TEAMS_PER_OWNER}個までです`);
  }
  const ref = db.collection('workspaces').doc();
  await ref.set({
    name,
    type: 'team',
    ownerId: user.uid,
    plan: 'free',
    members: { [user.uid]: 'owner' },
    memberUids: [user.uid],
    memberNames: { [user.uid]: user.name },
    createdAt: Date.now(),
  });
  return { id: ref.id };
}

/** 呼び出した人の、そのチームでの役割（メンバーでなければ権限エラー） */
async function roleIn(tx: Transaction | null, app: App, wid: string, uid: string) {
  const ref = getFirestore(app).collection('workspaces').doc(wid);
  const snap = tx ? await tx.get(ref) : await ref.get();
  if (!snap.exists) throw new ApiError(404, 'チームが見つかりません');
  const role = snap.get(`members.${uid}`) as Role | undefined;
  if (!role) throw new ApiError(403, 'このチームのメンバーではありません');
  return { ref, snap, role };
}

export async function createInvite(app: App, user: RequestUser, wid: string, role: unknown) {
  if (role !== 'admin' && role !== 'staff') throw new ApiError(400, '招待する役割を選んでください');
  const { snap, role: myRole } = await roleIn(null, app, wid, user.uid);
  if (snap.get('type') !== 'team') throw new ApiError(400, '個人用スペースには招待できません');
  if (!isManagerRole(myRole)) throw new ApiError(403, '招待できるのはオーナーと管理者だけです');

  // 推測されない長さのランダムな文字列を招待コードにする
  const code = randomBytes(12).toString('base64url');
  await getFirestore(app)
    .collection('invites')
    .doc(code)
    .set({
      workspaceId: wid,
      role,
      createdBy: user.uid,
      createdAt: Date.now(),
      expiresAt: Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000,
      maxUses: INVITE_MAX_USES,
      uses: 0,
    });
  return { code, expiresInDays: INVITE_DAYS };
}

/** 招待の中身を確かめる（使えない招待なら理由を返す） */
function checkInvite(invite: DocumentSnapshot) {
  if (!invite.exists) return '招待リンクが見つかりません。リンクが正しいか確認してください';
  if ((invite.get('expiresAt') as number) < Date.now()) return '招待リンクの有効期限が切れています。新しいリンクをもらってください';
  if ((invite.get('uses') as number) >= (invite.get('maxUses') as number)) return 'この招待リンクは使える回数の上限に達しています';
  return '';
}

export async function getInviteInfo(app: App, user: RequestUser, code: string) {
  const db = getFirestore(app);
  const invite = await db.collection('invites').doc(code).get();
  const problem = checkInvite(invite);
  if (problem) return { valid: false, reason: problem };
  const ws = await db.collection('workspaces').doc(invite.get('workspaceId')).get();
  if (!ws.exists) return { valid: false, reason: 'チームが見つかりません' };
  return {
    valid: true,
    workspaceId: ws.id,
    workspaceName: ws.get('name') as string,
    role: invite.get('role') as Role,
    alreadyMember: !!ws.get(`members.${user.uid}`),
  };
}

export async function acceptInvite(app: App, user: RequestUser, code: string) {
  const db = getFirestore(app);
  return db.runTransaction(async (tx) => {
    const inviteRef = db.collection('invites').doc(code);
    const invite = await tx.get(inviteRef);
    const problem = checkInvite(invite);
    if (problem) throw new ApiError(400, problem);
    const wsRef = db.collection('workspaces').doc(invite.get('workspaceId'));
    const ws = await tx.get(wsRef);
    if (!ws.exists) throw new ApiError(404, 'チームが見つかりません');
    // すでにメンバーなら、役割はそのまま（招待で役割が下がったり上がったりしないように）
    if (!ws.get(`members.${user.uid}`)) {
      tx.update(wsRef, {
        [`members.${user.uid}`]: invite.get('role'),
        memberUids: FieldValue.arrayUnion(user.uid),
        [`memberNames.${user.uid}`]: user.name,
      });
      tx.update(inviteRef, { uses: FieldValue.increment(1) });
    }
    return { workspaceId: wsRef.id };
  });
}

/** 役割の変更。オーナーの役割は変えられず、オーナーに変えることもできない */
export async function changeRole(app: App, user: RequestUser, wid: string, target: string, role: unknown) {
  if (role !== 'admin' && role !== 'staff') throw new ApiError(400, '役割は「管理者」か「スタッフ」を選んでください');
  const db = getFirestore(app);
  await db.runTransaction(async (tx) => {
    const { ref, snap, role: myRole } = await roleIn(tx, app, wid, user.uid);
    if (!isManagerRole(myRole)) throw new ApiError(403, '役割を変えられるのはオーナーと管理者だけです');
    const current = snap.get(`members.${target}`);
    if (!current) throw new ApiError(404, 'メンバーが見つかりません');
    if (current === 'owner') throw new ApiError(400, 'オーナーの役割は変えられません');
    tx.update(ref, { [`members.${target}`]: role });
  });
}

/** メンバーを外す（管理者が他の人を外す、または自分でチームを抜ける）。オーナーは外せない */
export async function removeMember(app: App, user: RequestUser, wid: string, target: string) {
  const db = getFirestore(app);
  await db.runTransaction(async (tx) => {
    const { ref, snap, role: myRole } = await roleIn(tx, app, wid, user.uid);
    if (target !== user.uid && !isManagerRole(myRole)) throw new ApiError(403, 'メンバーを外せるのはオーナーと管理者だけです');
    const current = snap.get(`members.${target}`);
    if (!current) throw new ApiError(404, 'メンバーが見つかりません');
    if (current === 'owner') throw new ApiError(400, 'オーナーはチームから外せません');
    tx.update(ref, {
      [`members.${target}`]: FieldValue.delete(),
      memberUids: FieldValue.arrayRemove(target),
      [`memberNames.${target}`]: FieldValue.delete(),
    });
  });
}
