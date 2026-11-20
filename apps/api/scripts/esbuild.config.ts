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

/** One bundle, dist/main.js. npm packages (including the workspace packages) stay external. */
export const options: esbuild.BuildOptions = {
  entryPoints: { main: 'src/main.ts' },
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  packages: 'external',
  outdir: 'dist',
  plugins: [swcPlugin],
};
