// ログインのたびに呼ぶ：個人用スペースを最新の形にし、チームでの表示名を更新する。
import { withUser } from '@/lib/server/api';
import { syncWorkspaces } from '@/lib/server/workspaces';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = (req: Request) => withUser(req, ({ app, user }) => syncWorkspaces(app, user));
