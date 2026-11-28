import fixtures from "./questionnaire.fixtures.json";
import {
  CPERM,
  assignableCompanyRoles,
  checkUpload,
  claimDraftProblems,
  claimTimeline,
  clampStep,
  companyMemberActions,
  compressionQuality,
  evidenceBodies,
  formatAnswer,
  isIsoDateText,
  parseClaimDraft,
  previewIdentifier,
  profileBody,
  profileChanged,
  resizeWidth,
  resolveBody,
  sameAnswers,
  startingAnswers,
  validateResolve,
  type ActivityView,
  type CompanyRole,
  type DeclaredProfile,
} from "./company";
import type { QuestionnaireDefinition } from "./questionnaire";

const def = fixtures.definition as unknown as QuestionnaireDefinition;

const roles: CompanyRole[] = [
  {
    id: "r-owner",
    key: "owner",
    name: "Owner",
    permissions: [CPERM.ownersManage, CPERM.membersManage, CPERM.membersInvite],
  },
  {
    id: "r-admin",
    key: "admin",
    name: "Administrator",
    permissions: [CPERM.membersManage, CPERM.membersInvite],
  },
  { id: "r-fin", key: "finance", name: "Finance", permissions: [CPERM.profileRead] },
  { id: "r-view", key: "viewer", name: "Viewer", permissions: [CPERM.profileRead] },
];

describe("registration number preview", () => {
  it("normalises 'rc 123-456' for a Company to RC 123456", () => {
    expect(previewIdentifier("company", "CAC", "rc 123-456")).toEqual({
      ok: true,
      display: "RC 123456",
    });
  });
  it("adds the prefix for bare digits and accepts CAC prefixes", () => {
    expect(previewIdentifier("business_name", "", "123456")).toEqual({
      ok: true,
      display: "BN 123456",
    });
    expect(previewIdentifier("company", "CAC", "CAC/RC/NO 123")).toEqual({
      ok: true,
      display: "RC 123",
    });
  });
  it("flags a wrong prefix and non-digits", () => {
    expect(previewIdentifier("company", "CAC", "BN 123")).toEqual({
      ok: false,
      reason: "prefix:RC",
    });
    expect(previewIdentifier("company", "CAC", "RC ABC")).toEqual({
      ok: false,
      reason: "digits:RC",
    });
  });
  it("shows nothing for blank input", () => {
    expect(previewIdentifier("company", "CAC", "  ")).toBeNull();
  });
});

describe("resolve", () => {
  it("builds the request with defaults and confirm_distinct only when set", () => {
    const base = {
      legalName: " Acme Ltd ",
      entityType: "company",
      jurisdiction: "",
      authority: "",
      identifier: "RC 1",
    };
    expect(resolveBody(base)).toEqual({
      legal_name: "Acme Ltd",
      entity_type: "company",
      jurisdiction: "NG",
      registration_authority: "CAC",
      identifier: "RC 1",
    });
    expect(resolveBody({ ...base, confirmDistinct: true })).toMatchObject({
      confirm_distinct: true,
    });
  });
  it("validates name and number", () => {
    const e = validateResolve({
      legalName: "",
      entityType: "company",
      jurisdiction: "NG",
      authority: "CAC",
      identifier: "",
    });
    expect(Object.keys(e).sort()).toEqual(["identifier", "legal_name"]);
  });
});

describe("claims", () => {
  it("tracks the three steps", () => {
    expect(claimTimeline("needs_information").map((s) => s.state)).toEqual([
      "done",
      "attention",
      "todo",
    ]);
    expect(claimTimeline("withdrawn").map((s) => s.label)).toEqual([
      "Submitted",
      "Review",
      "Withdrawn",
    ]);
  });
  it("checks files against the 10 MB limit and allowed types", () => {
    expect(checkUpload({ name: "a.pdf", size: 0, type: "application/pdf" })).toBe("empty");
    expect(checkUpload({ name: "a.pdf", size: 11 * 1024 * 1024, type: "application/pdf" })).toBe(
      "large",
    );
    expect(checkUpload({ name: "a.docx", size: 10, type: "application/msword" })).toBe("type");
    expect(checkUpload({ name: "a.pdf", size: 10, type: "application/pdf" })).toBeNull();
  });
  it("shrinks big camera pages and steps quality down", () => {
    expect(resizeWidth(4000, 3000)).toBe(2000);
    expect(resizeWidth(3000, 4000)).toBe(1500);
    expect(resizeWidth(1200, 900)).toBeUndefined();
    expect([0, 1, 2, 3].map(compressionQuality)).toEqual([0.7, 0.5, 0.35, null]);
  });
  it("makes one evidence item per page and one for a reference", () => {
    expect(evidenceBodies("cert", "Certificate", ["u1", "u2"], " RC-9 ")).toEqual([
      { type_key: "cert", description: "Certificate, page 1 of 2", upload_id: "u1" },
      { type_key: "cert", description: "Certificate, page 2 of 2", upload_id: "u2" },
      { type_key: "cert", description: "Certificate", reference: "RC-9" },
    ]);
    expect(evidenceBodies("cert", "Certificate", ["u1"], "")).toEqual([
      { type_key: "cert", description: "Certificate", upload_id: "u1" },
    ]);
  });
  it("reports what a draft still needs", () => {
    const d = parseClaimDraft(undefined);
    expect(claimDraftProblems(d, undefined)).toEqual(["type", "evidence"]);
    expect(
      claimDraftProblems({ ...d, typeKey: "c", reference: "x" }, { requires_file: true }),
    ).toEqual(["file"]);
    expect(
      claimDraftProblems(
        { ...d, typeKey: "c", capacity: "other", reference: "x" },
        { requires_file: false },
      ),
    ).toEqual(["capacity"]);
  });
  it("reads a stored draft defensively", () => {
    expect(parseClaimDraft("not json").pages).toEqual([]);
    const d = parseClaimDraft(
      JSON.stringify({
        capacity: "other",
        pages: [{ id: "p", uri: "file:///a", size: 3 }, { bad: 1 }],
        uploads: { p: "u" },
      }),
    );
    expect(d.capacity).toBe("other");
    expect(d.pages).toHaveLength(1);
    expect(d.uploads).toEqual({ p: "u" });
  });
});

describe("company members", () => {
  const owner = {
    permissions: [CPERM.ownersManage, CPERM.membersManage, CPERM.membersInvite, CPERM.profileRead],
    membership_id: "me",
  };
  const admin = { permissions: [CPERM.membersManage, CPERM.membersInvite], membership_id: "me" };
  it("offers an Administrator no Owner role and no escalation", () => {
    expect(assignableCompanyRoles(roles, owner.permissions).map((r) => r.id)).toEqual([
      "r-owner",
      "r-admin",
      "r-fin",
      "r-view",
    ]);
    expect(assignableCompanyRoles(roles, admin.permissions).map((r) => r.id)).toEqual(["r-admin"]);
  });
  it("lets an Owner act on others, and an Administrator not touch an Owner", () => {
    const fin = {
      id: "m2",
      status: "active",
      role: { id: "r-fin", key: "finance", name: "Finance" },
    };
    const own = {
      id: "m3",
      status: "active",
      role: { id: "r-owner", key: "owner", name: "Owner" },
    };
    expect(companyMemberActions(fin, owner, roles)).toEqual(["change_role", "suspend", "remove"]);
    expect(companyMemberActions(own, admin, roles)).toEqual([]);
    expect(companyMemberActions({ ...fin, status: "suspended" }, owner, roles)).toEqual([
      "reinstate",
      "remove",
    ]);
  });
  it("offers only leave on your own row, and nothing without manage rights", () => {
    const me = { id: "me", status: "active", role: { id: "r-owner", key: "owner", name: "Owner" } };
    expect(companyMemberActions(me, owner, roles)).toEqual(["leave"]);
    const fin = {
      id: "m2",
      status: "active",
      role: { id: "r-fin", key: "finance", name: "Finance" },
    };
    expect(
      companyMemberActions(fin, { permissions: [CPERM.profileRead], membership_id: "x" }, roles),
    ).toEqual([]);
  });
});

describe("declared profile", () => {
  const p: DeclaredProfile = {
    version: 3,
    registered_address: "1 Marina",
    incorporation_date: "2019-03-27",
    contact_email: null,
    contact_phone: null,
    website: null,
    source: "user",
    saved_by: null,
    saved_at: "",
  };
  it("sends every editable field with the version, blank as null, and never identity fields", () => {
    const body = profileBody(3, {
      address: " 2 Marina ",
      incorporationDate: "",
      email: "",
      phone: "",
      website: "",
    });
    expect(body).toEqual({
      expected_version: 3,
      registered_address: "2 Marina",
      incorporation_date: null,
      contact_email: null,
      contact_phone: null,
      website: null,
    });
    expect(Object.keys(body)).not.toContain("legal_name");
  });
  it("detects changes and validates dates", () => {
    expect(
      profileChanged(p, {
        address: "1 Marina",
        incorporationDate: "2019-03-27",
        email: "",
        phone: "",
        website: "",
      }),
    ).toBe(false);
    expect(
      profileChanged(p, {
        address: "x",
        incorporationDate: "2019-03-27",
        email: "",
        phone: "",
        website: "",
      }),
    ).toBe(true);
    expect(isIsoDateText("2019-02-30")).toBe(false);
    expect(isIsoDateText("2020-02-29")).toBe(true);
  });
});

describe("questionnaire helpers", () => {
  it("formats answers for reading", () => {
    const q = def.sections[0]!.questions;
    const kind = q.find((x) => x.key === "kind")!;
    const regulated = q.find((x) => x.key === "regulated")!;
    expect(formatAnswer(regulated, true)).toBe("Yes");
    expect(formatAnswer(regulated, false)).toBe("No");
    expect(formatAnswer(kind, kind.options![0]!.value)).toBe(kind.options![0]!.label);
    expect(formatAnswer(kind, undefined)).toBe("");
  });
  it("treats hidden-branch and blank answers as unchanged", () => {
    expect(
      sameAnswers(
        def,
        { kind: "other", name: "A", products: ["x"] },
        { kind: "other", name: "A", notes: " " },
      ),
    ).toBe(true);
    expect(sameAnswers(def, { kind: "other", name: "A" }, { kind: "other", name: "B" })).toBe(
      false,
    );
  });
  it("starts from device answers, then the server draft, then the current version", () => {
    const view = {
      draft: { answers: { name: "draft" } },
      current: { answers: { name: "current" } },
    } as unknown as ActivityView;
    expect(startingAnswers(view, { name: "device" })).toEqual({ name: "device" });
    expect(startingAnswers(view, null)).toEqual({ name: "draft" });
    expect(startingAnswers({ ...view, draft: null }, null)).toEqual({ name: "current" });
  });
  it("clamps the step when branches remove steps", () => {
    expect(clampStep(5, 3)).toBe(2);
    expect(clampStep(-1, 3)).toBe(0);
    expect(clampStep(0, 0)).toBe(0);
  });
});
