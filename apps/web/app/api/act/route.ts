import { proxy } from '@/lib/api.ts';

// Every member-area change: one action in, the member's fresh state out. Mail the action queued goes out after
// the response, for up to 4 minutes (see mailInBackground), so the function may live that long.
export const maxDuration = 300;
export const POST = (req: Request) => proxy(req, '/v1/me/actions');
