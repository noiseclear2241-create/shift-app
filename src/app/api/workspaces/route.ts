// チームを作る（作った人がオーナーになる）。
import { cleanText, readJson, withUser } from '@/lib/server/api';
import { createTeam } from '@/lib/server/workspaces';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = (req: Request) =>
  withUser(req, async ({ app, user }) => createTeam(app, user, cleanText((await readJson(req)).name, 40)));
