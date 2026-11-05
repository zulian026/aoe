import { defineConfig } from 'tsup';
import fs from 'node:fs';

const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));

export default defineConfig({
  entry: {
    bin: 'src/bin.ts',
    index: 'src/index.ts',
  },
  format: ['esm'],
  target: 'node20',
  clean: true,
  dts: true,
  sourcemap: false,
  external: ['ink', 'react', 'yoga-layout', 'commander', 'zod'],
  noExternal: [
    '@zyanx04/protocol',
    '@zyanx04/themes',
    '@zyanx04/core',
    '@zyanx04/components',
    '@zyanx04/adapters',
    '@zyanx04/renderer',
  ],
  define: {
    __CLI_VERSION__: JSON.stringify(pkg.version),
  },
});
