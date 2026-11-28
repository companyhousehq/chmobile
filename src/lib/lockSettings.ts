import { store } from "./storage/mmkv";

const KEY = "lock:enabled";

/** Whether the optional device lock is on (opt-in under Account > Security). */
export function isLockEnabled(): boolean {
  return store("app").getBoolean(KEY) === true;
}

export function setLockEnabled(enabled: boolean): void {
  store("app").set(KEY, enabled);
}
