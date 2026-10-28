// 開発用：テスト用データベース（エミュレーター）に、確認用のアカウントを2つ作る。
// 本番の Firebase には一切つながらない（127.0.0.1 のエミュレーターだけ）。
// 実行：npm run dev:emulator を起動した状態で  node scripts/emulator-seed.mjs
// owner は運営者としても確認できるよう、メールアドレスを「確認済み」にする（launch.json の ADMIN_EMAILS と合わせる）
export const TEST_ACCOUNTS = [
  { email: 'owner@shift.test', password: 'test-owner-2026', name: 'テスト管理者', verified: true },
  { email: 'staff@shift.test', password: 'test-staff-2026', name: 'テストスタッフ', verified: false },
];

const BASE = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';

async function call(path, body) {
  const res = await fetch(`${BASE}/${path}?key=demo-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

for (const a of TEST_ACCOUNTS) {
  let r = await call('accounts:signUp', { email: a.email, password: a.password, returnSecureToken: true });
  if (r.error?.message === 'EMAIL_EXISTS') {
    r = await call('accounts:signInWithPassword', { email: a.email, password: a.password, returnSecureToken: true });
  }
  if (!r.idToken) throw new Error(`${a.email}: ${JSON.stringify(r.error)}`);
  await call('accounts:update', { idToken: r.idToken, displayName: a.name });
  if (a.verified) {
    // エミュレーター専用の管理用API（メールアドレスを確認済みにする）
    await fetch(`http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/projects/demo-shift/accounts:update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
      body: JSON.stringify({ localId: r.localId, emailVerified: true }),
    });
  }
  console.log(`作成：${a.name}（${a.email}）`);
}
