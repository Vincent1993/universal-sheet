import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  source: {
    entry: {
      index: './src/index.ts',
    },
  },
  output: {
    cleanDistPath: true,
    minify: false,
    format: ['esm', 'cjs'],
  },
});
