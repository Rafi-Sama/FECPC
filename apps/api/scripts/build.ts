// pnpm build — bundles the API into dist/main.js (`pnpm start`) and dist/vercel.js (Vercel's function).
import * as esbuild from 'esbuild';
import { options } from './esbuild.config.ts';

await esbuild.build(options);
console.log('✓ API bundles built: dist/main.js, dist/vercel.js');
