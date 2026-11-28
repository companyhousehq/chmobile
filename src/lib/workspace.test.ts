import {
  PERM,
  assignableRoles,
  buildPicker,
  buildTeamRows,
  canManageCustomRole,
  canManageMember,
  createWorkspaceBody,
  draftFromWorkspace,
  filterTeamRows,
  identityLocked,
  leastPrivilegedRole,
  memberActions,
  permissionsToSend,
  profilePatch,
  roleInUse,
  showListControls,
  showRoles,
  splitEmails,
  togglePermission,
  type Invitation,
  type Member,
  type Workspace,
  type WorkspaceRole,
} from "./workspace";

const role = (id: string, key: string, permissions: string[], builtin = true): WorkspaceRole => ({
  id,
  key,
  name: key,
  builtin,
  permissions,
});
const owner = role("r-owner", "owner", [
  PERM.membersManage,
  PERM.membersInvite,
  PERM.ownersManage,
  PERM.rolesManage,
  PERM.profileRead,
]);
const admin = role("r-admin", "administrator", [
  PERM.membersManage,
  PERM.membersInvite,
  PERM.profileRead,
]);
const finance = role("r-fin", "finance", [PERM.profileRead]);
const viewer = role("r-view", "viewer", []);
const all = [owner, admin, finance, viewer];

describe("assignable roles (AC11)", () => {
  it("lets an Administrator invite Finance but not Owner", () => {
    const ids = assignableRoles(all, admin.permissions).map((r) => r.id);
    expect(ids).toContain("r-fin");
    expect(ids).not.toContain("r-owner");
  });
  it("offers an Owner every role", () => {
    expect(assignableRoles(all, owner.permissions)).toHaveLength(4);
  });
  it("picks the least privileged role as the default", () => {
    expect(leastPrivilegedRole(all)?.id).toBe("r-view");
  });
});

describe("member actions", () => {
  const m = (id: string, r: WorkspaceRole, status = "active"): Member => ({
    id,
    user: { id: `u-${id}`, full_name: id },
    role: { id: r.id, key: r.key, name: r.name },
    status,
    joined_at: "",
  });
  const adminCtx = { membership_id: "me", permissions: admin.permissions };
  it("hides Owner actions from an Administrator", () => {
    expect(canManageMember(owner, all, admin.permissions)).toBe(false);
    expect(memberActions(m("o", owner), adminCtx, all, "agency")).toEqual([]);
  });
  it("offers role change, suspend and remove for an active non-Owner", () => {
    expect(memberActions(m("f", finance), adminCtx, all, "agency")).toEqual([
      "change_role",
      "suspend",
      "remove",
    ]);
  });
  it("offers reinstate for a suspended member", () => {
    expect(memberActions(m("f", finance, "suspended"), adminCtx, all, "agency")).toContain(
      "reinstate",
    );
  });
  it("offers only leave on your own row, never in a personal workspace", () => {
    expect(memberActions(m("me", admin), adminCtx, all, "agency")).toEqual(["leave"]);
    expect(memberActions(m("me", admin), adminCtx, all, "personal")).toEqual([]);
  });
  it("offers nothing to a viewer", () => {
    expect(
      memberActions(m("f", finance), { membership_id: "me", permissions: [] }, all, "agency"),
    ).toEqual([]);
  });
});

describe("team rows", () => {
  const members: Member[] = [
    {
      id: "1",
      user: { id: "u1", full_name: "Ada Obi", email: "ada@x.ng" },
      role: { id: "r", name: "Owner" },
      status: "active",
      joined_at: "",
    },
    {
      id: "2",
      user: { id: "u2", full_name: "Bayo" },
      role: { id: "r", name: "Finance" },
      status: "suspended",
      joined_at: "",
    },
    {
      id: "3",
      user: { id: "u3", full_name: "Gone" },
      role: { id: "r", name: "Viewer" },
      status: "removed",
      joined_at: "",
    },
  ];
  const inv: Invitation[] = [
    {
      id: "i1",
      email: "new@x.ng",
      role: { id: "r", name: "Viewer" },
      status: "pending",
      invited_by: { full_name: "Ada" },
      expires_at: "2099-01-01T00:00:00Z",
      created_at: "",
    },
    {
      id: "i2",
      email: "old@x.ng",
      role: { id: "r", name: "Viewer" },
      status: "pending",
      invited_by: { full_name: "Ada" },
      expires_at: "2000-01-01T00:00:00Z",
      created_at: "",
    },
  ];
  const rows = buildTeamRows(members, inv);
  it("drops removed members and flags expired invitations", () => {
    expect(rows.map((r) => r.id)).toEqual(["1", "2", "i1", "i2"]);
    expect(rows.find((r) => r.id === "i2")?.status).toBe("expired");
  });
  it("filters by status and searches name, email and role", () => {
    expect(filterTeamRows(rows, "", "suspended").map((r) => r.id)).toEqual(["2"]);
    expect(filterTeamRows(rows, "", "invited").map((r) => r.id)).toEqual(["i1", "i2"]);
    expect(filterTeamRows(rows, "ada", "all").map((r) => r.id)).toEqual(["1"]);
    expect(filterTeamRows(rows, "finance", "all").map((r) => r.id)).toEqual(["2"]);
  });
  it("shows search and filter only above 20 rows", () => {
    expect(showListControls(20)).toBe(false);
    expect(showListControls(21)).toBe(true);
  });
});

describe("custom roles", () => {
  const custom = role("c1", "", [PERM.profileRead], false);
  it("can be managed only by a holder of roles.manage with all its access", () => {
    expect(canManageCustomRole(custom, "me", owner.permissions)).toBe(true);
    expect(canManageCustomRole(custom, "c1", owner.permissions)).toBe(false);
    expect(canManageCustomRole(owner, "me", owner.permissions)).toBe(false);
    expect(canManageCustomRole(custom, "me", admin.permissions)).toBe(false);
    expect(
      canManageCustomRole({ ...custom, permissions: [PERM.rolesManage] }, "me", [
        PERM.rolesManage,
        PERM.profileRead,
      ]),
    ).toBe(true);
    expect(
      canManageCustomRole(
        { ...custom, permissions: ["workspace.clients.read"] },
        "me",
        owner.permissions,
      ),
    ).toBe(false);
  });
  it("counts members and pending invitations as in use", () => {
    expect(roleInUse({ member_count: 0, pending_invitation_count: 0 })).toBe(false);
    expect(roleInUse({ member_count: 0, pending_invitation_count: 1 })).toBe(true);
  });
  it("shows Roles only for agency workspaces and the right permissions", () => {
    expect(showRoles("personal", [PERM.rolesManage])).toBe(false);
    expect(showRoles("agency", [PERM.membersRead])).toBe(true);
    expect(showRoles("agency", [])).toBe(false);
  });
});

describe("permission picker", () => {
  const cat = [
    {
      key: "p.base",
      label: "Base",
      category: "Profile",
      description: "",
      owner_only: false,
      baseline: true,
      held_by_caller: true,
    },
    {
      key: "p.a",
      label: "A",
      category: "Team",
      description: "",
      owner_only: false,
      baseline: false,
      held_by_caller: true,
    },
    {
      key: "p.b",
      label: "B",
      category: "Team",
      description: "",
      owner_only: false,
      baseline: false,
      held_by_caller: false,
    },
    {
      key: "p.o",
      label: "O",
      category: "Team",
      description: "",
      owner_only: true,
      baseline: false,
      held_by_caller: true,
    },
  ];
  const groups = buildPicker(cat, ["p.a"]);
  const items = groups.flatMap((g) => g.items);
  it("groups by category and locks the baseline on", () => {
    expect(groups.map((g) => g.category)).toEqual(["Profile", "Team"]);
    expect(items[0]).toMatchObject({ locked: true, selected: true, disabled: true });
  });
  it("disables permissions the caller lacks and Owner-only ones, with a reason", () => {
    expect(items.find((i) => i.key === "p.b")).toMatchObject({ disabled: true });
    expect(items.find((i) => i.key === "p.b")?.reason).toMatch(/access you have/);
    expect(items.find((i) => i.key === "p.o")?.reason).toMatch(/Owner/);
  });
  it("toggles only enabled items and always sends the baseline", () => {
    const a = items.find((i) => i.key === "p.a")!;
    const b = items.find((i) => i.key === "p.b")!;
    expect(togglePermission(["p.a"], a)).toEqual([]);
    expect(togglePermission([], a)).toEqual(["p.a"]);
    expect(togglePermission([], b)).toEqual([]);
    expect(permissionsToSend(cat, ["p.a"]).sort()).toEqual(["p.a", "p.base"]);
  });
});

describe("workspace profile and creation", () => {
  const ws: Workspace = {
    id: "w",
    type: "agency",
    display_name: "Okafor & Co",
    legal_profile_type: "registered_business",
    verification_status: "unverified",
    contact: { email: null, phone: null },
    address: { line1: null, line2: null, city: null, state: null, country: "NG" },
    registration: { authority: "CAC", entity_type: "company", identifier: "RC123" },
  };
  it("sends only changed identity fields", () => {
    const d = draftFromWorkspace(ws);
    const body = profilePatch(ws, { ...d, city: "Lagos" }, "");
    expect(body).not.toHaveProperty("display_name");
    expect(body).not.toHaveProperty("legal_profile_type");
    expect(body).not.toHaveProperty("registration");
    expect(body.address).toMatchObject({ city: "Lagos", country: "NG" });
    expect(body.contact).toBeNull();
    expect(profilePatch(ws, { ...d, displayName: "New" }, "")).toHaveProperty(
      "display_name",
      "New",
    );
    expect(profilePatch(ws, { ...d, identifier: "rc 999" }, "").registration).toEqual({
      authority: "CAC",
      entity_type: "company",
      identifier: "RC999",
    });
  });
  it("locks identity fields while verification is pending or verified", () => {
    expect(identityLocked("pending")).toBe(true);
    expect(identityLocked("verified")).toBe(true);
    expect(identityLocked("unverified")).toBe(false);
  });
  it("builds the create body with CAC registration only for registered businesses", () => {
    const base = {
      type: "agency" as const,
      displayName: " Acme ",
      legal: "registered_business",
      entityType: "business_name",
      identifier: "bn 12",
    };
    expect(createWorkspaceBody(base)).toEqual({
      type: "agency",
      display_name: "Acme",
      legal_profile_type: "registered_business",
      registration: { authority: "CAC", entity_type: "business_name", identifier: "BN12" },
    });
    expect(createWorkspaceBody({ ...base, legal: "individual" })).not.toHaveProperty(
      "registration",
    );
  });
  it("splits typed emails", () => {
    expect(splitEmails("a@x.ng, B@x.ng;a@x.ng\nc@x.ng")).toEqual(["a@x.ng", "b@x.ng", "c@x.ng"]);
  });
});
