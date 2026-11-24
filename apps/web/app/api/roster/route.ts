import { proxy } from '@/lib/api.ts';

export const GET = (req: Request) => proxy(req, '/v1/me/roster');
