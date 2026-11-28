import type { MyCompanyItem, MyWorkspaceItem } from "../types";

/**
 * Starting context and switcher (spec 0011 R4, R5, design 4.5). Pure: the
 * lists come from GET /v1/me/companies and GET /v1/me/workspaces, the last
 * used context from the `app` store. Which data a context may show is decided
 * by the API; this only picks where the app opens.
 */

export type ActingContext = { kind: "company"; id: string } | { kind: "workspace"; id: string };

export type StartingContext = ActingContext | { kind: "owner-start" };

export interface ContextLists {
  companies: MyCompanyItem[];
  workspaces: MyWorkspaceItem[];
}

export function sameContext(a: ActingContext | null, b: ActingContext | null): boolean {
  return !!a && !!b && a.kind === b.kind && a.id === b.id;
}

function time(iso: string): number {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

/** The company joined most recently: the stand-in for "most recently active" (design 0, gap 1). */
export function mostRecentlyJoinedCompany(companies: MyCompanyItem[]): MyCompanyItem | undefined {
  return [...companies].sort(
    (a, b) =>
      time(b.membership.joined_at) - time(a.membership.joined_at) ||
      a.company.id.localeCompare(b.company.id),
  )[0];
}

export function containsContext(lists: ContextLists, ctx: ActingContext): boolean {
  return ctx.kind === "company"
    ? lists.companies.some((c) => c.company.id === ctx.id)
    : lists.workspaces.some((w) => w.workspace.id === ctx.id);
}

/** The lists without one context (a company or workspace the user lost). */
export function withoutContext(lists: ContextLists, ctx: ActingContext): ContextLists {
  return {
    companies:
      ctx.kind === "company"
        ? lists.companies.filter((c) => c.company.id !== ctx.id)
        : lists.companies,
    workspaces:
      ctx.kind === "workspace"
        ? lists.workspaces.filter((w) => w.workspace.id !== ctx.id)
        : lists.workspaces,
  };
}

/**
 * R4: the last used context if it is still in the lists; else the most
 * recently joined company; else the first agent workspace; else the
 * business-owner start (with the "I work for an agency" link).
 */
export function resolveStartingContext(
  lists: ContextLists,
  lastUsed: ActingContext | null,
): StartingContext {
  if (lastUsed && containsContext(lists, lastUsed)) return lastUsed;
  const company = mostRecentlyJoinedCompany(lists.companies);
  if (company) return { kind: "company", id: company.company.id };
  const workspace = lists.workspaces[0];
  if (workspace) return { kind: "workspace", id: workspace.workspace.id };
  return { kind: "owner-start" };
}

export interface SwitcherEntry {
  context: ActingContext;
  label: string;
  current: boolean;
}

export interface SwitcherModel {
  /** False with one context or none: the switcher is not shown (R5, AC1). */
  visible: boolean;
  companies: SwitcherEntry[];
  /** Listed under "Your agent workspaces". */
  workspaces: SwitcherEntry[];
}

/** R5: companies first, then agent workspaces; shown only with more than one context. */
export function buildSwitcher(lists: ContextLists, current: ActingContext | null): SwitcherModel {
  const companies = lists.companies.map((c) => {
    const context: ActingContext = { kind: "company", id: c.company.id };
    return { context, label: c.company.legal_name, current: sameContext(context, current) };
  });
  const workspaces = lists.workspaces.map((w) => {
    const context: ActingContext = { kind: "workspace", id: w.workspace.id };
    return { context, label: w.workspace.display_name, current: sameContext(context, current) };
  });
  return {
    visible: companies.length + workspaces.length > 1,
    companies,
    workspaces,
  };
}

/** Route for a context; mirrors the web URLs so links map 1:1 (ADR 0012). */
export function contextHref(ctx: StartingContext): string {
  switch (ctx.kind) {
    case "company":
      return `/c/${ctx.id}`;
    case "workspace":
      return `/w/${ctx.id}`;
    case "owner-start":
      return "/start";
  }
}

/** Storage key for the last used context, per user so accounts never share it. */
export function lastContextKey(userId: string): string {
  return `ctx:${userId}`;
}

export function serializeContext(ctx: ActingContext): string {
  return `${ctx.kind}:${ctx.id}`;
}

export function parseContext(raw: string | undefined): ActingContext | null {
  if (!raw) return null;
  const i = raw.indexOf(":");
  const kind = raw.slice(0, i);
  const id = raw.slice(i + 1);
  if ((kind === "company" || kind === "workspace") && id.length > 0) return { kind, id };
  return null;
}
