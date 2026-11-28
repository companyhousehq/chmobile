import { gateFromMfaStage, gateFromRequirements } from "./gate";

describe("gates", () => {
  it("orders factor before enrolment before consent", () => {
    expect(gateFromRequirements(["consent", "factor"])).toBe("factor");
    expect(gateFromRequirements(["consent", "factor_setup"])).toBe("factor_setup");
    expect(gateFromRequirements(["consent"])).toBe("consent");
    expect(gateFromRequirements([])).toBeNull();
    expect(gateFromRequirements(undefined)).toBeNull();
  });
  it("maps the MFA stage", () => {
    expect(gateFromMfaStage("factor_required")).toBe("factor");
    expect(gateFromMfaStage("factor_setup_required")).toBe("factor_setup");
    expect(gateFromMfaStage("active")).toBeNull();
  });
});
