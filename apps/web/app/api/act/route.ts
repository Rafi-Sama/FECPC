import { proxy } from '@/lib/api.ts';

// Every member-area change: one action in, the member's fresh state out.
export const POST = (req: Request) => proxy(req, '/v1/me/actions');
