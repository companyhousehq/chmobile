import { mapFieldErrors, problemMessage } from "./problems";

describe("problemMessage", () => {
  it("has plain copy for the first codes", () => {
    expect(problemMessage({ type: "/problems/invalid-credentials", status: 401 })).toMatch(
      /don't match/,
    );
    expect(
      problemMessage({
        type: "/problems/too-many-attempts",
        status: 429,
        retry_after_seconds: 600,
      }),
    ).toContain("10 minutes");
    expect(problemMessage({ type: "/problems/unauthenticated", status: 401 })).toMatch(
      /Sign in again/,
    );
    expect(problemMessage({ type: "/problems/app-update-required", status: 426 })).toMatch(
      /Update/,
    );
  });

  it("falls back to the API title for unknown 4xx types and a generic line for 5xx", () => {
    expect(
      problemMessage({ type: "/problems/new-thing", status: 409, title: "Already done" }),
    ).toBe("Already done");
    expect(problemMessage({ type: "/problems/new-thing", status: 500, title: "x" })).toMatch(
      /our side/,
    );
  });

  it("never claims a government agency or completed filing", () => {
    const all = ["unavailable", "forbidden", "not-found", "consent-outdated"].map((t) =>
      problemMessage({ type: `/problems/${t}`, status: 400 }),
    );
    for (const m of all) expect(m).not.toMatch(/CAC|government|filed/i);
  });
});

describe("mapFieldErrors", () => {
  it("keeps the first message per field", () => {
    expect(
      mapFieldErrors([
        { field: "email", code: "invalid_email" },
        { field: "email", code: "required" },
      ]),
    ).toEqual({ email: "Enter a valid email address, like name@company.ng." });
  });
});

describe("newer problem copy", () => {
  it("has messages for the added slugs", () => {
    for (const slug of [
      "client-platform-unsupported",
      "push-device-not-registered",
      "upload-in-progress",
      "upload-expired",
      "idempotency-key-reused",
      "client-ip-required",
    ]) {
      expect(problemMessage({ type: `/problems/${slug}`, status: 400 })).not.toBe(
        "That didn't work. Try again in a moment.",
      );
    }
  });
});
