import { clientLabel, sortSessions } from "./sessions";
import type { SessionItem } from "./types";

const base = { id: "x", created_at: "", ip_approx: "", absolute_expires_at: "" };

describe("sessions", () => {
  it("labels clients", () => {
    expect(clientLabel({ client_platform: "ios", user_agent: "" })).toBe("iPhone app");
    expect(clientLabel({ client_platform: "android", user_agent: "" })).toBe("Android app");
    expect(
      clientLabel({
        client_platform: "web",
        user_agent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit Chrome/120 Safari/537",
      }),
    ).toBe("Chrome on macOS");
    expect(clientLabel({ user_agent: "" })).toBe("Web");
  });
  it("lists this device first", () => {
    const a: SessionItem = {
      ...base,
      id: "a",
      last_seen_at: "2026-01-02T00:00:00Z",
      user_agent: "",
      current: false,
    };
    const b: SessionItem = {
      ...base,
      id: "b",
      last_seen_at: "2026-01-01T00:00:00Z",
      user_agent: "",
      current: true,
    };
    expect(sortSessions([a, b]).map((s) => s.id)).toEqual(["b", "a"]);
  });
});
