// メンバーの役割変更（PATCH）と、チームから外す・抜ける（DELETE）。
import { readJson, withUser } from '@/lib/server/api';
import { changeRole, removeMember } from '@/lib/server/workspaces';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: { wid: string; uid: string } };

export const PATCH = (req: Request, { params }: Params) =>
  withUser(req, async ({ app, user }) => changeRole(app, user, params.wid, params.uid, (await readJson(req)).role));

export const DELETE = (req: Request, { params }: Params) =>
  withUser(req, ({ app, user }) => removeMember(app, user, params.wid, params.uid));
