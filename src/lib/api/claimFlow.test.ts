import { ApiError } from "./client";
import { isStaleUploadError, renewUploads, uploadPages, withUploadRenewal } from "./claimFlow";

jest.mock("expo-crypto", () => ({
  randomUUID: () => "uuid",
  getRandomBytes: () => new Uint8Array(0),
}));
jest.mock("./runtime", () => ({ api: { request: jest.fn() } }));

const page = (id: string) => ({
  id,
  uri: `file:///${id}.jpg`,
  name: "page.jpg",
  mime: "image/jpeg",
  size: 10,
});

describe("uploadPages", () => {
  it("uses the page id as the Idempotency-Key and reports each upload", async () => {
    const upload = jest.fn(async (_f: unknown, key: string) => ({ id: `up-${key}` }));
    const got: [string, string][] = [];
    const ids = await uploadPages(
      [page("a"), page("b")],
      {},
      () => undefined,
      (p, u) => got.push([p, u]),
      upload as never,
    );
    expect(ids).toEqual(["up-a", "up-b"]);
    expect(upload.mock.calls.map((c) => c[1])).toEqual(["a", "b"]);
    expect(got).toEqual([
      ["a", "up-a"],
      ["b", "up-b"],
    ]);
  });

  it("skips pages already uploaded, so an interrupted retry never stores a page twice", async () => {
    const upload = jest.fn(async () => ({ id: "up-new" }));
    const ids = await uploadPages(
      [page("a"), page("b")],
      { a: "up-old" },
      () => undefined,
      () => undefined,
      upload as never,
    );
    expect(ids).toEqual(["up-old", "up-new"]);
    expect(upload).toHaveBeenCalledTimes(1);
  });

  it("stops at the first failure and keeps what was uploaded", async () => {
    const upload = jest
      .fn()
      .mockResolvedValueOnce({ id: "u1" })
      .mockRejectedValueOnce(new Error("offline"));
    const kept: string[] = [];
    await expect(
      uploadPages(
        [page("a"), page("b"), page("c")],
        {},
        () => undefined,
        (p) => kept.push(p),
        upload as never,
      ),
    ).rejects.toThrow("offline");
    expect(kept).toEqual(["a"]);
    expect(upload).toHaveBeenCalledTimes(2);
  });
});

describe("stale upload recovery", () => {
  const invalid = new ApiError({
    type: "/problems/invalid",
    title: "x",
    status: 422,
    errors: [{ field: "evidence.0.upload_id", code: "unknown_upload" }],
  } as never);
  const expired = new ApiError({ type: "/problems/upload-expired", title: "x", status: 409 });

  it("recognises 422 unknown_upload and 409 upload-expired only", () => {
    expect(isStaleUploadError(invalid)).toBe(true);
    expect(isStaleUploadError(expired)).toBe(true);
    expect(
      isStaleUploadError(new ApiError({ type: "/problems/invalid", title: "", status: 422 })),
    ).toBe(false);
    expect(isStaleUploadError(new Error("x"))).toBe(false);
  });

  it("clears uploads and the submit key and renews page ids", () => {
    const d = renewUploads({
      capacity: "director",
      capacityOther: "",
      message: "",
      typeKey: "t",
      reference: "",
      pages: [page("a")],
      submitKey: "k",
      uploads: { a: "up" },
    });
    expect(d.uploads).toEqual({});
    expect(d.submitKey).toBe("");
    expect(d.pages[0]?.uri).toBe("file:///a.jpg");
  });

  it("renews and retries once, then gives up", async () => {
    const renew = jest.fn();
    const ok = jest.fn().mockRejectedValueOnce(invalid).mockResolvedValueOnce("done");
    await expect(withUploadRenewal(ok, renew)).resolves.toBe("done");
    expect(renew).toHaveBeenCalledTimes(1);
    const bad = jest.fn().mockRejectedValue(expired);
    await expect(withUploadRenewal(bad, renew)).rejects.toBe(expired);
    expect(bad).toHaveBeenCalledTimes(2);
  });
});
