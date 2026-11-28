import { QueryClient } from "@tanstack/react-query";
import { createApiClient } from "./client";
import { emitNotFound, notFoundScope, subscribeNotFound } from "./notFound";
import { dropContextFromCache } from "../context/dropContext";

describe("404 scope", () => {
  it("finds the company or workspace a path belongs to", () => {
    expect(notFoundScope("/v1/companies/c1/members")).toEqual({ kind: "company", id: "c1" });
    expect(notFoundScope("/v1/workspaces/w1/roles/r1")).toEqual({ kind: "workspace", id: "w1" });
    expect(notFoundScope("/v1/workspaces/w1/companies/c1")).toEqual({
      kind: "workspace",
      id: "w1",
    });
    expect(notFoundScope("/v1/companies/resolve")).toBeNull();
    expect(notFoundScope("/v1/me/companies")).toBeNull();
  });

  it("the API client reports every 404 path, and listeners hear it", async () => {
    const seen: string[] = [];
    const off = subscribeNotFound((s) => seen.push(`${s.kind}:${s.id}`));
    const client = createApiClient({
      baseUrl: "https://api.test",
      platform: "ios",
      appVersion: "1.0.0",
      buildNumber: "1",
      osVersion: "17",
      getToken: () => "t",
      onNotFound: emitNotFound,
      fetchImpl: (async () =>
        new Response(JSON.stringify({ type: "/problems/not-found", title: "x" }), {
          status: 404,
          headers: { "content-type": "application/problem+json" },
        })) as unknown as typeof fetch,
    });
    await expect(client.request("/v1/companies/c9/invitations")).rejects.toThrow();
    off();
    expect(seen).toEqual(["company:c9"]);
  });
});

describe("dropContextFromCache", () => {
  it("removes the lost context from cached lists and its queries", () => {
    const qc = new QueryClient();
    qc.setQueryData(["u", "u1", "contexts"], {
      companies: [{ company: { id: "c1" } }, { company: { id: "c2" } }],
      workspaces: [{ workspace: { id: "w1" } }],
    });
    qc.setQueryData(["u", "u1", "ws", "w1", "roles"], [1]);
    qc.setQueryData(["u", "u1", "co", "c1", "home"], 1);
    dropContextFromCache(qc, "u1", { kind: "workspace", id: "w1" });
    dropContextFromCache(qc, "u1", { kind: "company", id: "c1" });
    expect(qc.getQueryData(["u", "u1", "contexts"])).toEqual({
      companies: [{ company: { id: "c2" } }],
      workspaces: [],
    });
    expect(qc.getQueryData(["u", "u1", "ws", "w1", "roles"])).toBeUndefined();
    expect(qc.getQueryData(["u", "u1", "co", "c1", "home"])).toBeUndefined();
    qc.clear();
  });
});
