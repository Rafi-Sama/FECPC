import { proxy } from '@/lib/api.ts';

// The CSV streams straight through from the API.
export const GET = (req: Request) => proxy(req, '/v1/exports/members');
