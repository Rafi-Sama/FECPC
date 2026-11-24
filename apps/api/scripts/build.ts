// pnpm build — bundles the API into dist/main.js (`pnpm start`) and dist/inprocess.js (the API inside the web app).
import * as esbuild from 'esbuild';
import { options } from './esbuild.config.ts';

await esbuild.build(options);
console.log('✓ API bundles built: dist/main.js, dist/inprocess.js');
