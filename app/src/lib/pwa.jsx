/* PWA 接线（参考 iskill-pwa-guideline ④）：
   1) SW 注册：仅 http/https（file:// 打开时静默跳过）
   2) SW 更新感知：vite-plugin-pwa 的 onNeedRefresh
   3) 数据更新感知：启动时 no-store 拉 data/build-info.json，与 localStorage
      记住的 builtAt 比对——不一致说明 build 重新生成过数据，亮一条轻提示 */
import { useEffect, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

const LS_KEY = 'sm.buildAt';
const isHttp = () => /^https?:$/.test(typeof location !== 'undefined' ? location.protocol : '');

/** 三步法强刷：清全部 Cache Storage → 注销 SW → reload（marks.js 旧数据才会真正换掉） */
export function hardReload() {
  const clear = (window.caches && caches.keys)
    ? caches.keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => navigator.serviceWorker.getRegistrations())
      .then((regs) => Promise.all((regs || []).map((r) => r.unregister())))
    : Promise.resolve();
  clear.catch(() => {}).then(() => window.location.reload());
}

export function usePwa() {
  const [updateReady, setUpdateReady] = useState(false); // SW 有新版本
  const [dataChanged, setDataChanged] = useState(false); // build-info 指纹变了

  useEffect(() => {
    if (!isHttp()) return undefined;

    let onVisible;
    if ('serviceWorker' in navigator) {
      registerSW({
        immediate: true,
        onNeedRefresh: () => setUpdateReady(true),
        // 更新检查绕过 HTTP 缓存：托管方未下发 Cache-Control 时，浏览器会启发式缓存
        // sw.js（最长 24h），导致发布新版后「过一段时间才检测到」且时间不固定
        registrationOptions: { updateViaCache: 'none' },
      });
      // 从后台切回前台时主动查一次更新（覆盖 App 长驻不重开的场景）
      onVisible = () => {
        if (document.visibilityState !== 'visible') return;
        navigator.serviceWorker.getRegistration()
          .then((r) => r && r.update().catch(() => {}))
          .catch(() => {});
      };
      document.addEventListener('visibilitychange', onVisible);
    }

    if (typeof fetch === 'function') {
      fetch('./data/build-info.json', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((info) => {
          if (!info || !info.builtAt) return;
          let seen = null;
          try { seen = localStorage.getItem(LS_KEY); } catch { /* 忽略 */ }
          try { localStorage.setItem(LS_KEY, info.builtAt); } catch { /* 忽略 */ }
          if (seen && seen !== info.builtAt) setDataChanged(true);
        })
        .catch(() => {});
    }

    return () => { if (onVisible) document.removeEventListener('visibilitychange', onVisible); };
  }, []);

  return {
    show: updateReady || dataChanged,
    textKey: updateReady ? 'app_updated' : 'data_updated',
    onRefresh: hardReload,
    onDismiss: () => { setUpdateReady(false); setDataChanged(false); },
  };
}
