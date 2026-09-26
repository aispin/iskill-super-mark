/* Service Worker —— SuperMark 收藏册
   策略（参考 iskill-pwa-guideline）：
   - 应用壳（HTML/CSS/JS/图标/manifest）：install 时预缓存，离线可打开
   - data/marks.js 等内容数据：stale-while-revalidate（离线可读，后台拉新）
   - data/build-info.json：不拦截，让页面用 no-store 直连网络（版本感知依据，缓存会吃掉更新） */
'use strict';

var CACHE = 'supermark-v1';

var SHELL = [
  './',
  'index.html',
  'manifest.json',
  'assets/app.css',
  'assets/app.js',
  'assets/data.js',
  'assets/store.js',
  'assets/filter.js',
  'assets/charts.js',
  'assets/views.js',
  'assets/pwa.js',
  'assets/icons/icon.svg',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/icon-maskable-512.png',
  'assets/icons/apple-touch-icon.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k !== CACHE; })
          .map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  if (!e.request.url.startsWith(self.location.origin)) return;
  /* 版本指纹走网络直连：SWR 会「先旧后新」，指纹文件必须永远新鲜 */
  if (e.request.url.indexOf('build-info.json') !== -1) return;

  e.respondWith(
    caches.match(e.request).then(function (hit) {
      var net = fetch(e.request).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        }
        return res;
      }).catch(function () { return hit; });
      return hit || net;
    })
  );
});
