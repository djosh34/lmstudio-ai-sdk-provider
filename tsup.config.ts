import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    sourcemap: true,
  },
  {
    entry: ['src/exampleUsage.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    sourcemap: true,
  },
]);