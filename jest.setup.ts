// In-memory stand-ins for the native stores, so tests never touch a device.
jest.mock("expo-secure-store", () => {
  const items = new Map<string, string>();
  // Same key rule as the native module, which throws "Invalid key provided to SecureStore".
  const check = (k: string) => {
    if (!/^[\w.-]+$/.test(k)) throw new Error("Invalid key provided to SecureStore");
    return k;
  };
  return {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: "WHEN_UNLOCKED_THIS_DEVICE_ONLY",
    getItem: (k: string) => items.get(check(k)) ?? null,
    setItem: (k: string, v: string) => void items.set(check(k), v),
    getItemAsync: async (k: string) => items.get(check(k)) ?? null,
    setItemAsync: async (k: string, v: string) => void items.set(check(k), v),
    deleteItemAsync: async (k: string) => void items.delete(check(k)),
    __items: items,
  };
});

jest.mock("expo-crypto", () => ({
  getRandomBytes: (n: number) => Uint8Array.from({ length: n }, (_, i) => (i * 37 + 11) % 256),
}));

jest.mock("react-native-mmkv", () => {
  const instances = new Map<string, Map<string, string | number | boolean>>();
  return {
    createMMKV: ({ id }: { id: string }) => {
      const data = instances.get(id) ?? new Map<string, string | number | boolean>();
      instances.set(id, data);
      return {
        set: (k: string, v: string | number | boolean) => void data.set(k, v),
        getString: (k: string) => {
          const v = data.get(k);
          return typeof v === "string" ? v : undefined;
        },
        getBoolean: (k: string) => {
          const v = data.get(k);
          return typeof v === "boolean" ? v : undefined;
        },
        remove: (k: string) => data.delete(k),
        clearAll: () => data.clear(),
      };
    },
  };
});
