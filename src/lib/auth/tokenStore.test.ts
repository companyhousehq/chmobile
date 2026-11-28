import * as SecureStore from "expo-secure-store";
import {
  clearPendingLinkTokens,
  clearToken,
  currentToken,
  dropLinkToken,
  peekLinkToken,
  stashLinkToken,
  loadToken,
  saveToken,
} from "./tokenStore";

const items = (SecureStore as unknown as { __items: Map<string, string> }).__items;

describe("token store", () => {
  it("keeps the token in the secure store and memory, and removes it on clear", async () => {
    await saveToken("chs_secret");
    expect(items.get("session_token")).toBe("chs_secret");
    expect(currentToken()).toBe("chs_secret");
    expect(await loadToken()).toBe("chs_secret");

    await clearToken();
    expect(currentToken()).toBeNull();
    expect(items.has("session_token")).toBe(false);
  });

  it("clears parked link tokens", async () => {
    items.set("pending_link_token.invitation", "tok");
    await clearPendingLinkTokens();
    expect(items.has("pending_link_token.invitation")).toBe(false);
  });

  it("parks a link token for its route only, and expires it", async () => {
    stashLinkToken("email", "verify-email", "tok", 1000);
    expect(peekLinkToken("email", "verify-email", 2000)).toBe("tok");
    expect(peekLinkToken("email", "reset-password", 2000)).toBeNull();
    expect(peekLinkToken("email", "verify-email", 1000 + 8 * 24 * 3600 * 1000)).toBeNull();
    stashLinkToken("email", "verify-email", "tok2", 1000);
    await dropLinkToken("email");
    expect(peekLinkToken("email", "verify-email", 2000)).toBeNull();
  });
});
