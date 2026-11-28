import { hiddenCompanyTabs, hiddenWorkspaceTabs } from "./tabs";

describe("tab visibility", () => {
  it("hides nothing while permissions are unknown", () => {
    expect(hiddenCompanyTabs(undefined).size).toBe(0);
    expect(hiddenWorkspaceTabs(undefined).size).toBe(0);
  });
  it("hides company tabs without their permission", () => {
    expect([...hiddenCompanyTabs(["company.profile.read"])].sort()).toEqual(["agents", "people"]);
  });
  it("hides workspace tabs without their permission", () => {
    expect([...hiddenWorkspaceTabs(["workspace.clients.read"])].sort()).toEqual([
      "team",
      "workspace",
    ]);
    expect(hiddenWorkspaceTabs([]).has("clients")).toBe(true);
  });
});
