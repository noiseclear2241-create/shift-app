// 広告の選び方と、入力内容の確認（画面からもサーバーからも使う純粋な関数）。

import type { Ad } from './types';

/** 今日（YYYY-MM-DD）表示してよい広告か：掲載中で、掲載期間内 */
export function isAdLive(ad: Pick<Ad, 'status' | 'startDate' | 'endDate'>, today: string): boolean {
  if (ad.status !== 'active') return false;
  if (ad.startDate && today < ad.startDate) return false;
  if (ad.endDate && today > ad.endDate) return false;
  return true;
}

/**
 * 表示の割合（weight）に応じて1つ選ぶ。rand は 0以上1未満の数（テストでは固定値を渡す）。
 * 例：重み 3 と 1 なら、だいたい 3:1 の割合で表示される。
 */
export function pickWeighted<T extends { weight: number }>(items: T[], rand: number = Math.random()): T | null {
  const total = items.reduce((sum, i) => sum + Math.max(0, i.weight), 0);
  if (total <= 0) return null;
  let point = rand * total;
  for (const item of items) {
    point -= Math.max(0, item.weight);
    if (point < 0) return item;
  }
  return items[items.length - 1];
}

const isHttpsUrl = (s: string) => {
  try {
    return new URL(s).protocol === 'https:';
  } catch {
    return false;
  }
};

export interface AdInput {
  title: string;
  description: string;
  imageUrl: string;
  linkUrl: string;
  weight: number;
  startDate: string;
  endDate: string;
}

/** 管理画面から送られた広告の内容を整えて確かめる。問題があれば理由（日本語）を返す */
export function validateAdInput(raw: Record<string, unknown>): { ad: AdInput } | { error: string } {
  const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const date = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '');
  const ad: AdInput = {
    title: text(raw.title, 60),
    description: text(raw.description, 120),
    imageUrl: text(raw.imageUrl, 1000),
    linkUrl: text(raw.linkUrl, 2000),
    weight: Math.round(Number(raw.weight)),
    startDate: date(raw.startDate),
    endDate: date(raw.endDate),
  };
  if (!ad.title) return { error: 'タイトルを入力してください' };
  if (!isHttpsUrl(ad.linkUrl)) return { error: 'リンク先は https:// で始まるURLにしてください' };
  if (ad.imageUrl && !isHttpsUrl(ad.imageUrl)) return { error: '画像のURLは https:// で始まるURLにしてください' };
  if (!Number.isFinite(ad.weight) || ad.weight < 1 || ad.weight > 100) return { error: '表示の割合は 1〜100 の数字にしてください' };
  if (ad.startDate && ad.endDate && ad.endDate < ad.startDate) return { error: '掲載終了日は開始日より後にしてください' };
  return { ad };
}

/** クリック率（%）。表示が0回なら 0 */
export const clickRate = (impressions: number, clicks: number) =>
  impressions > 0 ? Math.round((clicks / impressions) * 1000) / 10 : 0;
