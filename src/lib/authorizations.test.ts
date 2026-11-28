import {
  approveBody,
  bucketAuthorizations,
  bucketRequests,
  categoryLabel,
  endsSoon,
  expiryForPreset,
  expiryProblem,
  filterClients,
  limitProblems,
  parseWorkspaceRef,
  portfolioSummary,
  requestBody,
  requestProblems,
  scopeLabel,
  statusMeta,
  summarizeAccess,
  toggleScope,
  accessDuration,
  type AuthorizationItem,
  type ClientItem,
} from "./authorizations";

const NOW = new Date("2026-11-27T10:00:00Z");

function auth(over: Partial<AuthorizationItem>): AuthorizationItem {
  return {
    id: "a1",
    company: { id: "c1", legal_name: "Acme Ltd" } as AuthorizationItem["company"],
    workspace: {
      id: "w1",
      type: "agency",
      display_name: "Beta Advisers",
      verification_status: "verified",
      declared_service_categories: [],
      verified_credentials: [],
    },
    status: "pending",
    initiated_by: "agent",
    action_scopes: [],
    service_categories: [],
    requested_action_scopes: ["company_profile.read"],
    requested_service_categories: ["cac"],
    request_note: null,
    requested_by: null,
    requested_at: "2026-11-01T00:00:00Z",
    request_expires_at: null,
    decided_by: null,
    decided_at: null,
    decision_note: null,
    valid_from: null,
    expires_at: null,
    ended_at: null,
    ended_by: null,
    ended_by_actor_type: null,
    ended_reason: null,
    created_at: "2026-11-01T00:00:00Z",
    updated_at: "2026-11-01T00:00:00Z",
    ...over,
  };
}

function client(name: string, scopes: string[], expires: string | null): ClientItem {
  const a = auth({ status: "active", action_scopes: scopes, expires_at: expires });
  return {
    company: {
      id: name,
      legal_name: name,
      primary_identifier: { identifier_display: "RC 1" },
    } as ClientItem["company"],
    authorization: a,
  };
}

describe("scope selection", () => {
  it("checks the view option an edit option needs, and unchecks dependants", () => {
    expect(toggleScope([], "company_profile.update", true)).toEqual([
      "company_profile.read",
      "company_profile.update",
    ]);
    expect(
      toggleScope(
        ["company_profile.read", "company_profile.update"],
        "company_profile.read",
        false,
      ),
    ).toEqual([]);
  });
});

describe("labels", () => {
  it("never shows a key", () => {
    expect(scopeLabel("company_profile.read")).toBe("View company details and business activities");
    expect(scopeLabel("something.new_thing")).toBe("Something new thing");
    expect(categoryLabel("cac")).toBe("CAC and corporate affairs");
    expect(categoryLabel("x", [{ key: "x", label: "Custom" }])).toBe("Custom");
  });
  it("describes statuses in plain words", () => {
    expect(statusMeta("pending").label).toBe("Waiting for approval");
    expect(statusMeta("revoked", "relinquished").label).toBe("Ended by the adviser");
    expect(statusMeta("cancelled", "superseded").label).toBe("Replaced");
    expect(statusMeta("expired", "request_timeout").label).toBe("Request expired");
  });
  it("summarises access", () => {
    expect(summarizeAccess(["company_profile.read"])).toBe("Can view company details");
    expect(summarizeAccess(["company_profile.update", "obligations.manage"])).toBe(
      "Can edit details and manage filings",
    );
  });
  it("shows the end of access", () => {
    expect(accessDuration(null)).toBe("Until removed");
    expect(accessDuration("2027-03-31T23:59:59Z")).toBe("Until 1 Apr 2027");
  });
});

describe("expiry", () => {
  it("builds dates from presets in the Lagos calendar", () => {
    expect(expiryForPreset("none", "", NOW)).toBe("");
    expect(expiryForPreset("3m", "", NOW)).toBe("2027-02-27");
    expect(expiryForPreset("1y", "", NOW)).toBe("2027-11-27");
    expect(expiryForPreset("custom", " 2027-01-05 ", NOW)).toBe("2027-01-05");
  });
  it("checks typed dates", () => {
    expect(expiryProblem("", { now: NOW })).toBeNull();
    expect(expiryProblem("31/03/2027", { now: NOW })).toMatch(/year-month-day/);
    expect(expiryProblem("2027-02-30", { now: NOW })).toMatch(/year-month-day/);
    expect(expiryProblem("2026-11-27", { now: NOW })).toMatch(/future/);
    expect(expiryProblem("2027-06-01", { now: NOW, latest: "2027-03-31T23:59:59Z" })).toMatch(
      /no later than/,
    );
    expect(expiryProblem("2027-03-01", { now: NOW, latest: "2027-03-31T23:59:59Z" })).toBeNull();
  });
});

describe("request and approval bodies", () => {
  it("builds the request body", () => {
    expect(
      requestBody({
        companyId: "c1",
        scopes: ["company_profile.read"],
        categories: ["cac"],
        expiresOn: "",
        note: " hi ",
      }),
    ).toEqual({
      company_id: "c1",
      action_scopes: ["company_profile.read"],
      service_categories: ["cac"],
      expires_at: null,
      request_note: "hi",
    });
  });
  it("needs something to do and an area", () => {
    expect(requestProblems({ scopes: [], categories: [], expiresOn: "" })).toEqual({
      action_scopes: expect.any(String),
      service_categories: expect.any(String),
    });
    expect(requestProblems({ scopes: ["a"], categories: ["b"], expiresOn: "" })).toEqual({});
  });
  it("allows as asked with no limits so the API keeps the request", () => {
    expect(
      approveBody({
        limited: false,
        scopes: ["x"],
        categories: ["y"],
        expiresOn: "2027-01-01",
        note: "",
      }),
    ).toEqual({});
  });
  it("sends limits and a shorter end only when limited", () => {
    expect(
      approveBody({
        limited: true,
        scopes: ["a"],
        categories: ["b"],
        expiresOn: "2027-01-01",
        note: "ok",
      }),
    ).toEqual({
      action_scopes: ["a"],
      service_categories: ["b"],
      expires_at: "2027-01-01",
      decision_note: "ok",
    });
  });
  it("refuses limits that go beyond what was asked", () => {
    const asked = {
      scopes: ["company_profile.read"],
      categories: ["cac"],
      expiresAt: "2027-03-31T23:59:59Z",
    };
    expect(
      limitProblems(
        asked,
        { scopes: ["company_profile.read"], categories: ["cac"], expiresOn: "" },
        NOW,
      ),
    ).toEqual({});
    expect(
      limitProblems(asked, { scopes: ["documents.read"], categories: ["tax"], expiresOn: "" }, NOW),
    ).toEqual({
      action_scopes: expect.any(String),
      service_categories: expect.any(String),
    });
    expect(
      limitProblems(
        asked,
        { scopes: ["company_profile.read"], categories: ["cac"], expiresOn: "2027-12-01" },
        NOW,
      ).expires_at,
    ).toBeTruthy();
  });
  it("reads a workspace reference", () => {
    expect(parseWorkspaceRef(" 123E4567-E89B-12D3-A456-426614174000 ")).toBe(
      "123e4567-e89b-12d3-a456-426614174000",
    );
    expect(parseWorkspaceRef("hello")).toBeNull();
  });
});

describe("company lists", () => {
  it("splits waiting, active and history", () => {
    const b = bucketAuthorizations([
      auth({ id: "p2", requested_at: "2026-11-05T00:00:00Z" }),
      auth({ id: "p1", requested_at: "2026-11-01T00:00:00Z" }),
      auth({ id: "act", status: "active" }),
      auth({ id: "old", status: "revoked", ended_at: "2026-10-01T00:00:00Z" }),
      auth({ id: "newer", status: "rejected", ended_at: "2026-11-01T00:00:00Z" }),
    ]);
    expect(b.waiting.map((a) => a.id)).toEqual(["p1", "p2"]);
    expect(b.active.map((a) => a.id)).toEqual(["act"]);
    expect(b.history.map((a) => a.id)).toEqual(["newer", "old"]);
  });
});

describe("agent portfolio", () => {
  const list = [
    client("Zed Foods", ["company_profile.read"], null),
    client("Acme Ltd", ["company_profile.update"], "2026-12-10T00:00:00Z"),
  ];
  it("summarises", () => {
    expect(portfolioSummary(list, 2, NOW.getTime())).toEqual({
      total: 2,
      canEdit: 1,
      endingSoon: 1,
      waiting: 2,
    });
  });
  it("filters and searches, sorted by name", () => {
    expect(filterClients(list, "", "all", NOW.getTime()).map((c) => c.company.legal_name)).toEqual([
      "Acme Ltd",
      "Zed Foods",
    ]);
    expect(filterClients(list, "zed", "all", NOW.getTime())).toHaveLength(1);
    expect(filterClients(list, "", "edit", NOW.getTime())[0]?.company.legal_name).toBe("Acme Ltd");
    expect(filterClients(list, "", "view", NOW.getTime())[0]?.company.legal_name).toBe("Zed Foods");
    expect(filterClients(list, "", "ending", NOW.getTime())).toHaveLength(1);
  });
  it("knows what ends soon", () => {
    expect(endsSoon(null)).toBe(false);
    expect(endsSoon("2027-06-01T00:00:00Z", NOW.getTime())).toBe(false);
  });
  it("splits requests", () => {
    const b = bucketRequests([
      auth({ id: "p" }),
      auth({ id: "x", status: "rejected" }),
      auth({ id: "a", status: "active" }),
    ]);
    expect(b.pending.map((a) => a.id)).toEqual(["p"]);
    expect(b.past.map((a) => a.id)).toEqual(["x"]);
  });
});
