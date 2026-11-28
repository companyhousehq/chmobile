import { shouldRetryQuery } from "./queryClient";

describe("shouldRetryQuery", () => {
  it("never retries 4xx", () => {
    for (const status of [400, 401, 404, 422, 499]) {
      expect(shouldRetryQuery(0, { status })).toBe(false);
    }
  });
  it("retries network errors and 5xx twice", () => {
    expect(shouldRetryQuery(0, new Error("network"))).toBe(true);
    expect(shouldRetryQuery(1, { status: 503 })).toBe(true);
    expect(shouldRetryQuery(2, { status: 503 })).toBe(false);
    expect(shouldRetryQuery(0, { status: 500 })).toBe(true);
  });
});
