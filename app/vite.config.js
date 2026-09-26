import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * 目录约定：
 * - app/ 是 Vite 源码工程，可被拷贝进实例（instance/app/）独立 npm install。
 * - DATA_ROOT：实例根目录（含 data/、media/），默认取 app/ 的上级目录，可用环境变量覆盖。
 * - OUT_DIR：构建产物目录，默认 dist/；实例重建时指向实例根目录，产物与 data/、media/ 同级。
 */
const APP_DIR = dirname(fileURLToPath(import.meta.url));
const toAbs = (p, base) => (isAbsolute(p) ? p : resolvePath(base, p));
const DATA_ROOT = toAbs(process.env.DATA_ROOT || '..', APP_DIR);
const OUT_DIR = process.env.OUT_DIR ? toAbs(process.env.OUT_DIR, process.cwd()) : 'dist';

/**
 * 开发期数据服务：把实例的 data/（marks.js、build-info.json）与 media/（mp3 音频）
 * 映射到 dev server，使本地开发与构建产物行为一致。
 */
function serveInstanceData() {
  return {
    name: 'serve-instance-data',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const m = /^\/(data|media)\/(.+)$/.exec((req.url || '').split('?')[0]);
        if (!m) return next();
        const file = join(DATA_ROOT, m[1], decodeURIComponent(m[2]));
        if (!file.startsWith(DATA_ROOT)) { res.statusCode = 403; return res.end(); }
        try {
          const buf = readFileSync(file);
          res.setHeader('content-type', m[1] === 'media' ? 'audio/mpeg' : 'application/javascript');
          return res.end(buf);
        } catch { res.statusCode = 404; return res.end('not found'); }
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    serveInstanceData(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: null, // 注册逻辑在 src/lib/pwa.jsx（协议守卫 + 自定义 Toast）
      manifest: {
        name: '收藏册 · super-mark',
        short_name: '收藏册',
        description: '把微信里随手收藏的内容，变成一本可检索、可分类、有洞察的个人收藏册。',
        lang: 'zh-CN',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#0c0a09',
        theme_color: '#0c0a09',
        icons: [
          { src: './icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: './icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: './icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // 应用壳：入口 HTML 与构建出的 js/css/图标全部预缓存
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        globIgnores: ['data/**', 'media/**'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/data\//, /^\/media\//],
        runtimeCaching: [
          {
            // 运行时数据：离线可读、后台拉新（SWR）
            urlPattern: /\/data\/marks\.js$/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'sm-data', expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
          {
            // 抓取的音频：大文件，命中后长期使用
            urlPattern: /\/media\/.+\.(mp3|m4a|mp4)$/,
            handler: 'CacheFirst',
            options: { cacheName: 'sm-media', rangeRequests: true, expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 180 } },
          },
          {
            // 版本指纹：永远优先网络（NetworkFirst 兜底离线），保证更新提示及时
            urlPattern: /\/data\/build-info\.json$/,
            handler: 'NetworkFirst',
            options: { cacheName: 'sm-buildinfo', networkTimeoutSeconds: 2, expiration: { maxEntries: 2 } },
          },
        ],
      },
    }),
  ],
  build: {
    // 构建产物直接落到实例根目录（index.html + assets/），与 data/、media/ 同级，
    // 现有静态服务无需改动。不清空目录，避免误删数据。
    outDir: OUT_DIR,
    emptyOutDir: false,
  },
  server: {
    port: 5188,
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
});
