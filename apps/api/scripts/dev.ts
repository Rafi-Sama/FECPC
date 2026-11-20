// pnpm dev — rebuilds dist/main.js on every change and restarts the server after each successful build.
import * as esbuild from 'esbuild';
import { spawn, type ChildProcess } from 'node:child_process';
import { options } from './esbuild.config.ts';

let child: ChildProcess | null = null;

const restart: esbuild.Plugin = {
  name: 'restart-server',
  setup(build) {
    build.onEnd((result) => {
      if (result.errors.length) return console.error('Build failed; the old server keeps running.');
      child?.kill('SIGTERM');
      child = spawn('node', ['dist/main.js'], { stdio: 'inherit', env: process.env });
    });
  },
};

const ctx = await esbuild.context({ ...options, plugins: [...options.plugins!, restart] });
await ctx.watch();
console.log('✓ Watching src/ ...');

const stop = async () => {
  child?.kill('SIGTERM');
  await ctx.dispose();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
