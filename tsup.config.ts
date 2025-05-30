import { defineConfig } from 'tsup';
 
export default defineConfig({
    // format: ['cjs', 'esm'],
    // dts: true,
    format: ['cjs'],
    entry: ['./src/index.ts', './src/commands/**/*.ts'],
    shims: true,
    skipNodeModulesBundle: true,
    clean: true,
    outDir: 'lib',
});