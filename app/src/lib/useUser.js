import { useSyncExternalStore } from 'react';
import { subscribeUser, storeGet } from './store';

let version = 0;
subscribeUser(() => { version++; });

/** 订阅用户标注变化；组件内随后用 storeGet(id) 读取最新值 */
export function useUserVersion() {
  return useSyncExternalStore(subscribeUser, () => version);
}

export { storeGet, storeSet, storeInit } from './store';
