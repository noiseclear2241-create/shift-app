// ログイン中の人が運営者かどうか。運営者でない場合は、その理由も返す（設定の確認用）。
// 運営者のメールアドレスの一覧そのものは返さない。
import { withUser } from '@/lib/server/api';
import { isPlatformAdmin } from '@/lib/server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = (req: Request) =>
  withUser(req, async ({ user }) => {
    const configured = (process.env.ADMIN_EMAILS ?? '').split(',').some((s) => s.trim());
    const admin = isPlatformAdmin(user);
    let reason = '';
    if (!admin) {
      if (!configured) reason = 'サーバーに運営者のメールアドレス（ADMIN_EMAILS）が登録されていません。Vercel で登録して Redeploy してください。';
      else if (!user.emailVerified) reason = 'このアカウントはメールアドレスの本人確認が済んでいません。「Google でログイン」で入り直してください。';
      else reason = 'このアカウントのメールアドレスは、運営者として登録されていません。ADMIN_EMAILS の値と同じか確認してください。';
    }
    return { admin, email: user.email, reason };
  });
