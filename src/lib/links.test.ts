import { parseLink, rewriteEmailPath, routeHref } from "./links";

describe("parseLink", () => {
  it("reads tokens from universal links and the custom scheme", () => {
    expect(parseLink("https://www.companyhouse.ng/verify-email?token=abc%2B1")).toEqual({
      route: "verify-email",
      token: "abc+1",
    });
    expect(parseLink("companyhouse://reset-password?token=t1")).toEqual({
      route: "reset-password",
      token: "t1",
    });
    expect(parseLink("/confirm-email-change/?token=z")?.route).toBe("confirm-email-change");
    expect(parseLink("https://x.ng/invitations/accept?token=q")?.route).toBe("invitation");
  });
  it("ignores other links and tolerates a missing token", () => {
    expect(parseLink("https://www.companyhouse.ng/c/123")).toBeNull();
    expect(parseLink("/verify-email")).toEqual({ route: "verify-email", token: null });
  });
  it("routes without the query", () => {
    expect(routeHref("verify-email")).toBe("/verify-email");
    expect(routeHref("invitation")).toBe("/invitation");
  });
});

describe("emailed web paths", () => {
  it("maps every path the API emails to an app screen", () => {
    const h = "https://www.companyhouse.ng";
    expect(rewriteEmailPath(`${h}/c/c1/authorizations`)).toBe("/c/c1/agents");
    expect(rewriteEmailPath(`${h}/w/w1/companies`)).toBe("/w/w1/clients?tab=requests");
    expect(rewriteEmailPath(`${h}/w/w1/settings/verification`)).toBe("/w/w1/workspace");
    expect(rewriteEmailPath(`${h}/w/w1/settings/capabilities`)).toBe("/w/w1/workspace");
    expect(rewriteEmailPath(`${h}/account/security`)).toBe("/security");
    expect(rewriteEmailPath("companyhouse://c/c1/authorizations")).toBe("/c/c1/agents");
  });
  it("leaves other paths alone", () => {
    expect(rewriteEmailPath("/c/c1/agents")).toBeNull();
    expect(rewriteEmailPath("/login")).toBeNull();
  });
});
