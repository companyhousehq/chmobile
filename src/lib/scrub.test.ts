import { scrubBreadcrumb, scrubEvent, scrubUrl } from "./scrub";

const UUID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

describe("scrubEvent", () => {
  const event = {
    message: `Failed for jane@example.com with chs_abcDEF123456 on ${UUID}`,
    request: {
      url: `https://api.companyhouse.ng/v1/companies/${UUID}?token=secret123#frag`,
      headers: { Authorization: "Bearer chs_abcDEF123456" },
      cookies: "a=b",
      data: { password: "hunter2" },
    },
    extra: { note: "personal" },
    user: { email: "jane@example.com" },
    contexts: { device: { name: "Jane's iPhone", model: "iPhone15,2" } },
  };

  it("removes tokens, emails, ids, query strings, headers, bodies and user data", () => {
    const out = JSON.stringify(scrubEvent(event));
    for (const secret of [
      "jane@example.com",
      "chs_abcDEF123456",
      UUID,
      "token=secret123",
      "frag",
      "Authorization",
      "hunter2",
      "Jane's iPhone",
      "personal",
    ]) {
      expect(out).not.toContain(secret);
    }
    expect(out).toContain("iPhone15,2");
  });

  it("strips query and fragment from urls", () => {
    expect(scrubUrl("https://x.test/a/b?token=abc#z")).toBe("https://x.test/a/b");
  });
});

describe("scrubBreadcrumb", () => {
  it("drops console breadcrumbs and scrubs others", () => {
    expect(scrubBreadcrumb({ category: "console" })).toBeNull();
    const crumb = scrubBreadcrumb({ category: "navigation", data: { from: "/a" }, message: UUID });
    expect(JSON.stringify(crumb)).not.toContain(UUID);
  });
});
