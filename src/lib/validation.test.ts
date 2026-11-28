import { checkPassword, isEmail, normalizePhone, normalizeTotp } from "./validation";

describe("validation", () => {
  it("checks emails", () => {
    expect(isEmail("a@b.ng")).toBe(true);
    expect(isEmail("a@b")).toBe(false);
    expect(isEmail("a b@c.ng")).toBe(false);
  });
  it("normalises Nigerian phones", () => {
    expect(normalizePhone("0803 123 4567")).toBe("+2348031234567");
    expect(normalizePhone("2348031234567")).toBe("+2348031234567");
    expect(normalizePhone("+44 20 7946 0958")).toBe("+442079460958");
    expect(normalizePhone("  ")).toBe("");
  });
  it("checks passwords locally", () => {
    expect(checkPassword("short").longEnough).toBe(false);
    expect(checkPassword("a-long-enough-pass").longEnough).toBe(true);
    expect(checkPassword("A@b.ng", "a@b.ng").sameAsEmail).toBe(true);
  });
  it("keeps six digits of a code", () => {
    expect(normalizeTotp("123 456 789")).toBe("123456");
  });
});
