import { proxy } from '@/lib/api.ts';

export const GET = (req: Request) => proxy(req, '/v1/events');
export const POST = (req: Request) => proxy(req, '/v1/queries/events');
