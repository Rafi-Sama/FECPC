// pnpm build — bundles the API into dist/main.js (run with `pnpm start`).
import * as esbuild from 'esbuild';
import { options } from './esbuild.config.ts';

await esbuild.build(options);
console.log('✓ API bundle built: dist/main.js');
