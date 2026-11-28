import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { createMMKV, type MMKV } from "react-native-mmkv";

/**
 * Encrypted local storage (design 1, 9). MMKV instances are encrypted with a
 * random 256-bit key kept in the secure store. The key survives sign-out (so
 * the next user gets fresh, empty instances) and is the only thing here that
 * lives in the secure store besides the session token.
 */

const KEY_NAME = "mmkv_key";
const KEY_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&*+-=?@^_~";

const secureOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

/** 32 ASCII characters (AES-256 takes at most 32 bytes), drawn without modulo bias. */
export function generateKey(randomBytes: (n: number) => Uint8Array): string {
  const limit = 256 - (256 % KEY_ALPHABET.length);
  let out = "";
  while (out.length < 32) {
    for (const byte of randomBytes(48)) {
      if (byte < limit && out.length < 32) out += KEY_ALPHABET[byte % KEY_ALPHABET.length];
    }
  }
  return out;
}

function encryptionKey(): string {
  let key = SecureStore.getItem(KEY_NAME, secureOptions);
  if (!key) {
    key = generateKey((n) => Crypto.getRandomBytes(n));
    SecureStore.setItem(KEY_NAME, key, secureOptions);
  }
  return key;
}

/** Instance ids (design 9.3 wipes all three). */
export const STORES = ["cache", "drafts", "app"] as const;
export type StoreId = (typeof STORES)[number];

const instances = new Map<StoreId, MMKV>();

export function store(id: StoreId): MMKV {
  let s = instances.get(id);
  if (!s) {
    s = createMMKV({ id, encryptionKey: encryptionKey(), encryptionType: "AES-256" });
    instances.set(id, s);
  }
  return s;
}

export function clearAllStores(): void {
  for (const id of STORES) store(id).clearAll();
}
