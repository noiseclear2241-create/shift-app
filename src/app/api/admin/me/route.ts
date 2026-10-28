// ログイン中の人が運営者かどうか（設定画面に「広告の管理」を出すかどうかに使う）
import { withUser } from '@/lib/server/api';
import { isPlatformAdmin } from '@/lib/server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = (req: Request) => withUser(req, async ({ user }) => ({ admin: isPlatformAdmin(user) }));
