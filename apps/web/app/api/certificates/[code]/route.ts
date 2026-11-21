import { proxy } from '@/lib/api.ts';

export const GET = async (req: Request, { params }: { params: Promise<{ code: string }> }) =>
  proxy(req, `/v1/certificates/${encodeURIComponent((await params).code)}`);
