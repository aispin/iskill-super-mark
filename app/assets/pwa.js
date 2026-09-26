/* PWA 接线（参考 iskill-pwa-guideline ④）：
   1) SW 注册：仅 http/https（file:// 打开时静默跳过，双击可用性不受影响）
   2) 版本感知：启动时 no-store 拉 data/build-info.json，与 localStorage 里
      记住的 builtAt 比对——不一致说明 build 重新生成过数据，亮一条可关闭的
      底部轻提示，点击即三步法强刷（清缓存 → 注销 SW → reload） */
(function () {
  'use strict';
  var LS_KEY = 'sm.buildAt';

  /* ---------- SW 注册（协议守卫） ---------- */
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', reg);
    } else { reg(); }
  }
  function reg() {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }

  /* ---------- 版本感知 ---------- */
  function checkUpdate() {
    if (!/^https?:$/.test(location.protocol) || !window.fetch) return;
    fetch('data/build-info.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (info) {
        if (!info || !info.builtAt) return;
        var seen = null;
        try { seen = localStorage.getItem(LS_KEY); } catch (e) {}
        if (!seen) { save(info.builtAt); return; }        // 首访只记录，不提示
        if (seen !== info.builtAt) {
          save(info.builtAt);
          toast();
        }
      })
      .catch(function () {});
  }
  function save(v) { try { localStorage.setItem(LS_KEY, v); } catch (e) {} }

  /* 三步法强刷：清全部 Cache Storage → 注销 SW → reload。
     updateSW(true) 只换 SW 不清运行时缓存，marks.js 的旧数据会残留 */
  function hardReload() {
    var clear = (window.caches && caches.keys) ?
      caches.keys().then(function (keys) {
        return Promise.all(keys.map(function (k) { return caches.delete(k); }));
      }).then(function () {
        return navigator.serviceWorker.getRegistrations();
      }).then(function (regs) {
        return Promise.all(regs.map(function (r) { return r.unregister(); }));
      }) : Promise.resolve();
    clear.catch(function () {}).then(function () { location.reload(); });
  }

  /* ---------- 底部轻提示（不打断、可关闭） ---------- */
  function toast() {
    if (document.getElementById('pwa-toast')) return;
    var el = document.createElement('div');
    el.id = 'pwa-toast';
    el.setAttribute('role', 'status');
    el.innerHTML = '<span>收藏数据已更新，刷新查看新内容</span>' +
      '<button type="button" data-act="refresh">刷新</button>' +
      '<button type="button" data-act="close" aria-label="关闭">✕</button>';
    el.addEventListener('click', function (ev) {
      var act = ev.target && ev.target.getAttribute('data-act');
      if (act === 'refresh') hardReload();
      el.remove();
    });
    document.body.appendChild(el);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkUpdate);
  } else { checkUpdate(); }
})();
