import type { MyCompanyItem, MyWorkspaceItem } from "../types";
import {
  buildSwitcher,
  contextHref,
  lastContextKey,
  parseContext,
  resolveStartingContext,
  serializeContext,
  type ContextLists,
} from "./startingContext";

const company = (id: string, joined: string): MyCompanyItem => ({
  company: { id, legal_name: `Company ${id}` },
  membership: { id: `m-${id}`, role: { id: "r", name: "Owner" }, joined_at: joined },
});
const workspace = (id: string): MyWorkspaceItem => ({
  workspace: { id, type: "agency", display_name: `Agency ${id}` },
  membership: {
    id: `m-${id}`,
    role: { id: "r", name: "Owner" },
    joined_at: "2026-01-01T00:00:00Z",
  },
});

const none: ContextLists = { companies: [], workspaces: [] };

describe("resolveStartingContext (R4)", () => {
  it("AC1: one company only opens that company", () => {
    const lists = { ...none, companies: [company("c1", "2026-01-01T00:00:00Z")] };
    expect(resolveStartingContext(lists, null)).toEqual({ kind: "company", id: "c1" });
  });

  it("AC2: agent workspaces only opens agent home", () => {
    const lists = { ...none, workspaces: [workspace("w1"), workspace("w2")] };
    expect(resolveStartingContext(lists, null)).toEqual({ kind: "workspace", id: "w1" });
  });

  it("AC3: first launch with both opens the most recently joined company", () => {
    const lists = {
      companies: [company("old", "2025-01-01T00:00:00Z"), company("new", "2026-06-01T00:00:00Z")],
      workspaces: [workspace("w1")],
    };
    expect(resolveStartingContext(lists, null)).toEqual({ kind: "company", id: "new" });
  });

  it("AC3: after switching to the workspace, relaunch opens there", () => {
    const lists = {
      companies: [company("c1", "2026-01-01T00:00:00Z")],
      workspaces: [workspace("w1")],
    };
    expect(resolveStartingContext(lists, { kind: "workspace", id: "w1" })).toEqual({
      kind: "workspace",
      id: "w1",
    });
  });

  it("ignores a last used context that is no longer in the lists", () => {
    const lists = { companies: [company("c1", "2026-01-01T00:00:00Z")], workspaces: [] };
    expect(resolveStartingContext(lists, { kind: "workspace", id: "gone" })).toEqual({
      kind: "company",
      id: "c1",
    });
  });

  it("AC4: no memberships opens the business-owner start", () => {
    expect(resolveStartingContext(none, null)).toEqual({ kind: "owner-start" });
    expect(contextHref({ kind: "owner-start" })).toBe("/start");
  });

  it("breaks joined_at ties by id, deterministically", () => {
    const lists = {
      ...none,
      companies: [company("b", "2026-01-01T00:00:00Z"), company("a", "2026-01-01T00:00:00Z")],
    };
    expect(resolveStartingContext(lists, null)).toEqual({ kind: "company", id: "a" });
  });
});

describe("buildSwitcher (R5)", () => {
  it("AC1: hidden with a single context", () => {
    expect(
      buildSwitcher({ ...none, companies: [company("c1", "2026-01-01T00:00:00Z")] }, null).visible,
    ).toBe(false);
    expect(buildSwitcher(none, null).visible).toBe(false);
  });

  it("shows for any mix of more than one context, companies first", () => {
    const lists = {
      companies: [company("c1", "2026-01-01T00:00:00Z")],
      workspaces: [workspace("w1")],
    };
    const model = buildSwitcher(lists, { kind: "company", id: "c1" });
    expect(model.visible).toBe(true);
    expect(model.companies.map((e) => e.label)).toEqual(["Company c1"]);
    expect(model.workspaces.map((e) => e.label)).toEqual(["Agency w1"]);
    expect(model.companies[0]?.current).toBe(true);
    expect(model.workspaces[0]?.current).toBe(false);
  });

  it("shows with two workspaces and no company", () => {
    expect(
      buildSwitcher({ ...none, workspaces: [workspace("a"), workspace("b")] }, null).visible,
    ).toBe(true);
  });
});

describe("last used context storage", () => {
  it("round-trips and rejects garbage", () => {
    const ctx = { kind: "workspace", id: "w:1" } as const;
    expect(parseContext(serializeContext(ctx))).toEqual(ctx);
    expect(parseContext(undefined)).toBeNull();
    expect(parseContext("nonsense")).toBeNull();
    expect(parseContext("company:")).toBeNull();
  });

  it("is keyed per user and routes mirror the web", () => {
    expect(lastContextKey("u1")).toBe("ctx:u1");
    expect(contextHref({ kind: "company", id: "x" })).toBe("/c/x");
    expect(contextHref({ kind: "workspace", id: "y" })).toBe("/w/y");
  });
});
