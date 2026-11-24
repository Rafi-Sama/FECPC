import * as esbuild from 'esbuild';
import * as swc from '@swc/core';
import * as fs from 'node:fs';

// esbuild cannot emit decorator metadata, which Nest's dependency injection needs, so SWC compiles each .ts file.
const swcPlugin: esbuild.Plugin = {
  name: 'swc-decorator-metadata',
  setup(build) {
    build.onLoad({ filter: /\.ts$/ }, async (args) => {
      const code = await fs.promises.readFile(args.path, 'utf8');
      const { code: contents } = swc.transformSync(code, {
        filename: args.path,
        jsc: {
          parser: { syntax: 'typescript', decorators: true, dynamicImport: true },
          transform: { legacyDecorator: true, decoratorMetadata: true },
          target: 'es2022',
          keepClassNames: true,
        },
        module: { type: 'es6' },
      });
      return { contents, loader: 'js' };
    });
  },
};

// npm packages stay external; the workspace packages (@fecpc/*, TypeScript source) are bundled, so the runtime
// never has to strip types from files it reaches through node_modules.
const deps = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  dependencies: Record<string, string>;
};

/** dist/main.js (a Node server) and dist/vercel.js (Vercel's request handler). */
export const options: esbuild.BuildOptions = {
  entryPoints: { main: 'src/main.ts', vercel: 'src/vercel.ts' },
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  external: Object.keys(deps.dependencies).filter((d) => !d.startsWith('@fecpc/')),
  outdir: 'dist',
  plugins: [swcPlugin],
};
