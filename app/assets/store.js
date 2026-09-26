/* 用户标注持久化：localStorage 为主（file:// 亦可用），IndexedDB 可用时自动升级并迁移 */
window.SM = window.SM || {};
(function () {
  const LS_KEY = 'supermark.user.v1';
  const DB_NAME = 'supermark';
  const STORE = 'marks';

  let backend = 'localstorage';
  let db = null;
  const cache = Object.create(null);

  function lsLoad() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; }
  }
  function lsSave(obj) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(obj)); } catch { /* 配额已满，忽略 */ }
  }

  function idbOpen() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) return reject(new Error('no idb'));
      let req;
      try { req = indexedDB.open(DB_NAME, 1); } catch (e) { return reject(e); }
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('idb error'));
      setTimeout(() => reject(new Error('idb timeout')), 1200);
    });
  }
  function idbGetAll() {
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE, 'readonly');
        const r = tx.objectStore(STORE).get('all');
        r.onsuccess = () => resolve(r.result || {});
        r.onerror = () => resolve({});
      } catch { resolve({}); }
    });
  }
  function idbPut(obj) {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(obj, 'all');
    } catch { /* 忽略 */ }
  }

  async function init() {
    const ls = lsLoad();
    Object.assign(cache, ls);
    try {
      db = await idbOpen();
      const remote = await idbGetAll();
      Object.assign(cache, Object.keys(remote).length >= Object.keys(ls).length ? remote : ls);
      backend = 'indexeddb';
      idbPut(cache); // 迁移：历史 localStorage 数据写入 IDB
    } catch {
      backend = 'localstorage';
    }
    return backend;
  }

  function get(id) {
    return cache[id] || { readStatus: 'unread', starred: false, rating: 0, note: '' };
  }
  function set(id, patch) {
    cache[id] = Object.assign(get(id), patch, { updatedAt: new Date().toISOString() });
    if (backend === 'indexeddb') idbPut(cache);
    else lsSave(cache);
  }
  function all() { return cache; }
  function clear() {
    for (const k of Object.keys(cache)) delete cache[k];
    if (backend === 'indexeddb') idbPut(cache);
    else lsSave(cache);
  }

  SM.store = { init, get, set, all, clear, backend: () => backend };
})();
