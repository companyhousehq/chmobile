import { ApiError, createApiClient, type ApiClientOptions } from "./client";

function respond(
  status: number,
  body?: unknown,
  contentType = "application/problem+json",
): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": contentType },
  });
}

function setup(fetchImpl: jest.Mock, extra: Partial<ApiClientOptions> = {}) {
  return createApiClient({
    baseUrl: "https://api.test",
    platform: "ios",
    appVersion: "1.4.0",
    buildNumber: "120",
    osVersion: "17.5",
    getToken: () => "chs_token",
    fetchImpl: fetchImpl as unknown as typeof fetch,
    ...extra,
  });
}

describe("api client", () => {
  it("passes multipart bodies through without a JSON content type", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(respond(201, { ok: true }, "application/json"));
    const form = new FormData();
    form.append("note", "x");
    await setup(fetchImpl).request("/v1/me/claim-uploads", { method: "POST", body: form });
    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBe(form);
    expect((init.headers as Record<string, string>)["Content-Type"]).toBeUndefined();
  });

  it("sends client identification and the bearer token", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(respond(200, { ok: true }, "application/json"));
    await setup(fetchImpl).request("/v1/me", { query: { a: "1" } });

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.test/v1/me?a=1");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer chs_token",
      "X-Client-Platform": "ios",
      "X-App-Version": "1.4.0",
      "User-Agent": "CompanyHouse/1.4.0 (ios 17.5; build 120)",
    });
  });

  it("omits the token for anonymous calls", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(respond(200, {}, "application/json"));
    await setup(fetchImpl).request("/v1/auth/login", {
      method: "POST",
      body: { a: 1 },
      anonymous: true,
    });
    const init = fetchImpl.mock.calls[0]![1] as RequestInit;
    expect(init.headers).not.toHaveProperty("Authorization");
    expect(init.body).toBe('{"a":1}');
  });

  it("parses problem+json into ApiError", async () => {
    const problem = { type: "/problems/forbidden", title: "Forbidden", status: 403 };
    const fetchImpl = jest.fn().mockResolvedValue(respond(403, problem));
    const err = await setup(fetchImpl)
      .request("/v1/x")
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(403);
    expect((err as ApiError).slug).toBe("forbidden");
  });

  it("wipes on a 401 for a signed-in request, but not for sign-in itself", async () => {
    const onUnauthenticated = jest.fn();
    const problem = { type: "/problems/unauthenticated", title: "x", status: 401 };
    const fetchImpl = jest.fn().mockImplementation(async () => respond(401, problem));
    const client = setup(fetchImpl, { onUnauthenticated });

    await expect(client.request("/v1/me")).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthenticated).toHaveBeenCalledTimes(1);

    await expect(client.request("/v1/auth/login", { anonymous: true })).rejects.toBeInstanceOf(
      ApiError,
    );
    expect(onUnauthenticated).toHaveBeenCalledTimes(1);
  });

  it("routes a 426 to the update screen", async () => {
    const onUpdateRequired = jest.fn();
    const problem = {
      type: "/problems/app-update-required",
      title: "Update",
      status: 426,
      min_version: "1.5.0",
    };
    const fetchImpl = jest.fn().mockResolvedValue(respond(426, problem));
    await setup(fetchImpl, { onUpdateRequired })
      .request("/v1/me")
      .catch(() => {});
    expect(onUpdateRequired).toHaveBeenCalledWith(
      expect.objectContaining({ min_version: "1.5.0" }),
    );
  });

  it("treats client-identification-required like an update prompt", async () => {
    const onUpdateRequired = jest.fn();
    const fetchImpl = jest.fn().mockResolvedValue(
      respond(400, {
        type: "/problems/client-identification-required",
        title: "x",
        status: 400,
      }),
    );
    await setup(fetchImpl, { onUpdateRequired })
      .request("/v1/auth/login", { anonymous: true })
      .catch(() => {});
    expect(onUpdateRequired).toHaveBeenCalledTimes(1);
  });

  it("reports a gated session (factor or consent) without signing out", async () => {
    const onGateRequired = jest.fn();
    const onUnauthenticated = jest.fn();
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(
        respond(403, { type: "/problems/consent-required", title: "x", status: 403 }),
      );
    await setup(fetchImpl, { onGateRequired, onUnauthenticated })
      .request("/v1/me")
      .catch(() => {});
    expect(onGateRequired).toHaveBeenCalledWith("consent-required");
    expect(onUnauthenticated).not.toHaveBeenCalled();
  });

  it("reports network failure as unavailable, without leaking the cause", async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new TypeError("Network request failed"));
    const err = (await setup(fetchImpl)
      .request("/v1/me")
      .catch((e: unknown) => e)) as ApiError;
    expect(err.slug).toBe("unavailable");
    expect(err.message).not.toContain("Network request failed");
  });

  it("follows cursors in getAll", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(respond(200, { items: [1, 2], next_cursor: "c2" }, "application/json"))
      .mockResolvedValueOnce(respond(200, { items: [3], next_cursor: null }, "application/json"));
    expect(await setup(fetchImpl).getAll<number>("/v1/me/companies")).toEqual([1, 2, 3]);
    expect(fetchImpl.mock.calls[1]![0]).toContain("cursor=c2");
  });
});
