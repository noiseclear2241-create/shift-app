// サーバー専用：広告の管理（運営者のみ）・表示する広告の選択・表示回数とクリック数の記録。
// 広告のデータ（ads）は、画面から直接は読み書きできない（firestore.rules ですべて拒否）。

import type { App } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { isAdLive, pickWeighted, validateAdInput } from '../ads';
import { addDays } from '../schedule';
import { todayIn } from '../notifications';
import type { Ad, ServedAd } from '../types';
import { ApiError } from './api';
import { isPlatformAdmin, type RequestUser } from './auth';

const STATS_DAYS = 30;
const today = () => todayIn('Asia/Tokyo');

function requireAdmin(user: RequestUser) {
  if (!isPlatformAdmin(user)) throw new ApiError(403, '広告を管理できるのは運営者だけです');
}

const adsCol = (app: App) => getFirestore(app).collection('ads');

/** 運営者向け：広告の一覧と、直近30日・合計の表示回数とクリック数 */
export async function listAdsForAdmin(app: App, user: RequestUser) {
  requireAdmin(user);
  const snap = await adsCol(app).orderBy('createdAt', 'desc').get();
  const since = addDays(today(), -(STATS_DAYS - 1));
  const ads = await Promise.all(
    snap.docs.map(async (d) => {
      const stats = await d.ref.collection('stats').where('date', '>=', since).get();
      const recent = stats.docs.reduce(
        (sum, s) => ({ impressions: sum.impressions + (s.get('impressions') ?? 0), clicks: sum.clicks + (s.get('clicks') ?? 0) }),
        { impressions: 0, clicks: 0 },
      );
      return {
        ...(d.data() as Omit<Ad, 'id'>),
        id: d.id,
        recent,
        total: { impressions: d.get('totalImpressions') ?? 0, clicks: d.get('totalClicks') ?? 0 },
        live: isAdLive(d.data() as Ad, today()),
      };
    }),
  );
  return { ads, today: today(), statsDays: STATS_DAYS };
}

export async function createAd(app: App, user: RequestUser, raw: Record<string, unknown>) {
  requireAdmin(user);
  const r = validateAdInput(raw);
  if ('error' in r) throw new ApiError(400, r.error);
  const now = Date.now();
  const ref = await adsCol(app).add({
    ...r.ad,
    slot: 'home',
    status: 'active',
    totalImpressions: 0,
    totalClicks: 0,
    createdBy: user.uid,
    createdAt: now,
    updatedAt: now,
  });
  return { id: ref.id };
}

export async function updateAd(app: App, user: RequestUser, id: string, raw: Record<string, unknown>) {
  requireAdmin(user);
  const ref = adsCol(app).doc(id);
  if (!(await ref.get()).exists) throw new ApiError(404, '広告が見つかりません');
  // 状態（掲載中・停止）だけの変更
  if (raw.status === 'active' || raw.status === 'paused') {
    if (Object.keys(raw).length === 1) {
      await ref.update({ status: raw.status, updatedAt: Date.now() });
      return;
    }
  }
  const r = validateAdInput(raw);
  if ('error' in r) throw new ApiError(400, r.error);
  await ref.update({ ...r.ad, updatedAt: Date.now() });
}

export async function deleteAd(app: App, user: RequestUser, id: string) {
  requireAdmin(user);
  // 日ごとの記録（stats）もまとめて削除する
  await getFirestore(app).recursiveDelete(adsCol(app).doc(id));
}

/** 日ごとの記録と合計に1を足す */
async function count(app: App, id: string, field: 'impressions' | 'clicks') {
  const ref = adsCol(app).doc(id);
  const date = today();
  await Promise.all([
    ref.collection('stats').doc(date).set({ date, [field]: FieldValue.increment(1) }, { merge: true }),
    ref.update({ [field === 'impressions' ? 'totalImpressions' : 'totalClicks']: FieldValue.increment(1) }),
  ]);
}

/**
 * 画面に表示する広告を1つ選び、表示回数を記録する。
 * 有料プランのスペースや、メンバーでないスペースを指定された場合は広告を出さない。
 */
export async function serveAd(app: App, user: RequestUser, workspaceId: string, slot: string): Promise<{ ad: ServedAd | null }> {
  if (slot !== 'home') return { ad: null };
  const db = getFirestore(app);
  const ws = await db.collection('workspaces').doc(workspaceId).get();
  if (!ws.exists || !ws.get(`members.${user.uid}`)) return { ad: null };
  if ((ws.get('plan') ?? 'free') !== 'free') return { ad: null };

  const snap = await adsCol(app).where('status', '==', 'active').where('slot', '==', slot).get();
  const live = snap.docs
    .map((d) => ({ ...(d.data() as Omit<Ad, 'id'>), id: d.id }))
    .filter((ad) => isAdLive(ad, today()));
  const picked = pickWeighted(live);
  if (!picked) return { ad: null };

  await count(app, picked.id, 'impressions');
  return {
    ad: {
      id: picked.id,
      title: picked.title,
      description: picked.description,
      imageUrl: picked.imageUrl,
      clickUrl: `/api/ads/${picked.id}/click`,
    },
  };
}

/** クリックを記録して、広告のリンク先を返す（登録されたURL以外へは移動させない） */
export async function recordClick(app: App, id: string): Promise<string | null> {
  const snap = await adsCol(app).doc(id).get();
  if (!snap.exists) return null;
  const url = snap.get('linkUrl') as string;
  if (!/^https:\/\//.test(url)) return null;
  // 停止中・期間外の広告は数えずに移動だけする（古い画面から押された場合など）
  if (isAdLive(snap.data() as Ad, today())) await count(app, id, 'clicks');
  return url;
}
