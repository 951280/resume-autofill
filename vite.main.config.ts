import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * 主构建：background service worker + popup 页 + options 页。
 * 在 content 构建之后运行（emptyOutDir: false，避免清掉 content.js）。
 */
export default defineConfig({
  plugins: [react()],
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    target: 'chrome110',
    modulePreload: false,
    rollupOptions: {
      input: {
        popup: 'popup.html',
        options: 'options.html',
        background: 'src/background/index.ts',
      },
      output: {
        // background 必须是稳定文件名（manifest 里写死），其它走 hash
        entryFileNames: (chunk) =>
          chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
