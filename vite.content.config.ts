import { defineConfig } from 'vite';

/**
 * content script 构建：MV3 的 content script 必须是 classic script，
 * 所以用 lib + iife 打包成单文件，不能有 import / code splitting。
 * 必须先于主构建执行（emptyOutDir: true）。
 */
export default defineConfig({
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'chrome110',
    minify: false,
    lib: {
      entry: 'src/content/index.ts',
      formats: ['iife'],
      name: 'ResumeAutoFill',
      fileName: () => 'content.js',
    },
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
  },
});
