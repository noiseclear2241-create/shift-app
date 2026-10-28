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

export interface ParsedAdCode {
  linkUrl: string;
  imageUrl: string;
  /** バナー画像の大きさ（コードに書かれていれば） */
  width: number;
  height: number;
  /** テキスト広告のときのリンクの文字 */
  text: string;
}

/**
 * A8.net・楽天などの広告コード（HTML）から、リンク先URLと画像URLを取り出す。
 * コードそのものは保存・実行しない（取り出した https のURLだけを使う）。
 * 表示回数を数えるための 1×1 の画像は、バナー画像として扱わない。
 */
export function parseAdCode(html: string): ParsedAdCode | { error: string } {
  const attr = (tag: string, name: string) => {
    const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
    return (m?.[1] ?? m?.[2] ?? m?.[3] ?? '').replace(/&amp;/g, '&').trim();
  };
  const anchor = html.match(/<a\b[^>]*>([\s\S]*?)<\/a>/i);
  if (!anchor) return { error: '広告コードの中にリンク（<a href="...">）が見つかりません' };
  const linkUrl = attr(anchor[0].match(/<a\b[^>]*>/i)?.[0] ?? '', 'href');
  if (!isHttpsUrl(linkUrl)) return { error: 'リンク先が https:// で始まるURLではありません' };

  // バナー画像：リンクの中の画像のうち、1×1 の目印ではないもの
  const images = [...anchor[1].matchAll(/<img\b[^>]*>/gi)].map((m) => ({
    src: attr(m[0], 'src'),
    width: Number(attr(m[0], 'width')) || 0,
    height: Number(attr(m[0], 'height')) || 0,
  }));
  const banner = images.find((i) => isHttpsUrl(i.src) && !(i.width === 1 && i.height === 1));
  const text = anchor[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

  return {
    linkUrl,
    imageUrl: banner?.src ?? '',
    width: banner?.width ?? 0,
    height: banner?.height ?? 0,
    text,
  };
}

/** バナーの形。広告枠に合うのは正方形に近いもの（square）か横長（wide） */
export function bannerShape(width: number, height: number): 'square' | 'wide' | 'tall' | 'unknown' {
  if (!width || !height) return 'unknown';
  const ratio = width / height;
  if (ratio >= 2) return 'wide';
  if (ratio <= 0.6) return 'tall';
  return 'square';
}

/** クリック率（%）。表示が0回なら 0 */
export const clickRate = (impressions: number, clicks: number) =>
  impressions > 0 ? Math.round((clicks / impressions) * 1000) / 10 : 0;
