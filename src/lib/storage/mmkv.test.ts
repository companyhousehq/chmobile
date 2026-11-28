import * as SecureStore from "expo-secure-store";
import { clearAllStores, generateKey, store } from "./mmkv";

describe("encrypted storage", () => {
  it("generates a 32-character key from the supplied randomness", () => {
    const key = generateKey((n) => Uint8Array.from({ length: n }, (_, i) => i * 5));
    expect(key).toHaveLength(32);
    expect(key).toMatch(/^[\x21-\x7e]+$/);
  });

  it("keeps its key in the secure store and wipes values but not the key", () => {
    store("app").set("k", "v");
    expect(SecureStore.getItem("mmkv_key")).toHaveLength(32);
    clearAllStores();
    expect(store("app").getString("k")).toBeUndefined();
    expect(SecureStore.getItem("mmkv_key")).toHaveLength(32);
  });
});
