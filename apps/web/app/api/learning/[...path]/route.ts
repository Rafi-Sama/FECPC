import { proxy } from '@/lib/api.ts';

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

async function forward(req: Request, ctx: RouteContext) {
  const { path } = await ctx.params;
  const url = new URL(req.url);
  const target = `/v1/learning/${path.map(encodeURIComponent).join('/')}${url.search}`;
  return proxy(req, target);
}

export const GET = (req: Request, ctx: RouteContext) => forward(req, ctx);
export const POST = (req: Request, ctx: RouteContext) => forward(req, ctx);
export const PATCH = (req: Request, ctx: RouteContext) => forward(req, ctx);
export const DELETE = (req: Request, ctx: RouteContext) => forward(req, ctx);
