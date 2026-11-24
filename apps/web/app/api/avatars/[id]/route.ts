import { proxy } from '@/lib/api.ts';

export const GET = async (req: Request, { params }: { params: Promise<{ id: string }> }) =>
  proxy(req, `/v1/avatars/${encodeURIComponent((await params).id)}`);
