import { proxy } from '@/lib/api.ts';

export const POST = (req: Request) => proxy(req, '/v1/auth/login');
