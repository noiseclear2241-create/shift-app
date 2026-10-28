// サーバー専用：/api/... の処理で共通して使う部品。
import type { App } from 'firebase-admin/app';
import { NextResponse } from 'next/server';
import { verifyRequest, type RequestUser } from './auth';
import { getAdminApp } from './firebaseAdmin';

/** 画面に返すエラー。status は HTTP の番号（400：入力の誤り、403：権限なし など） */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * ログインを確かめてから処理を行う。
 * 処理の中で ApiError を投げると、その内容を画面に返す。
 */
export async function withUser(
  req: Request,
  handler: (ctx: { app: App; user: RequestUser }) => Promise<unknown>,
) {
  const app = getAdminApp();
  if (!app) return NextResponse.json({ error: 'サーバーの設定（FIREBASE_SERVICE_ACCOUNT）がまだ登録されていません' }, { status: 503 });
  const user = await verifyRequest(app, req);
  if (!user) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 });
  try {
    return NextResponse.json((await handler({ app, user })) ?? { ok: true });
  } catch (e) {
    if (e instanceof ApiError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error('api error', e);
    return NextResponse.json({ error: 'サーバーでエラーが発生しました' }, { status: 500 });
  }
}

/** 画面から送られた JSON を読む（壊れていたら空のオブジェクト） */
export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** 文字列の入力を整える（前後の空白を除き、長すぎるものは切る） */
export const cleanText = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
