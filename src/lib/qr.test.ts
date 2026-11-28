import { encodeQr } from "./qr";

describe("encodeQr", () => {
  it("encodes a short string as version 1 with finder patterns and the fixed dark module", () => {
    const qr = encodeQr("HELLO");
    expect(qr.version).toBe(1);
    expect(qr.size).toBe(21);
    expect(qr.modules).toHaveLength(21 * 21);
    expect(qr.modules[0]).toBe(true);
    expect(qr.modules[3 * 21 + 3]).toBe(true);
    expect(qr.modules[1 * 21 + 1]).toBe(false);
    expect(qr.modules[(21 - 8) * 21 + 8]).toBe(true);
  });

  it("encodes a realistic otpauth URI locally", () => {
    const qr = encodeQr(
      "otpauth://totp/Company%20House:a%40b.test?algorithm=SHA1&digits=6&issuer=Company+House&period=30&secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP",
    );
    expect(qr.version).toBeGreaterThanOrEqual(7);
    expect(qr.version).toBeLessThanOrEqual(12);
  });

  it("rejects payloads above capacity", () => {
    expect(() => encodeQr("A".repeat(400))).toThrow(/too long/);
  });
});
