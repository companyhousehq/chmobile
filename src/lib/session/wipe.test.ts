import { signOutWipe, type WipeSteps } from "./wipe";

function steps(log: string[], failing: string[] = []): WipeSteps {
  const make = (name: string) => () => {
    log.push(name);
    if (failing.includes(name)) throw new Error("boom");
  };
  return {
    clearMemoryToken: make("clearMemoryToken"),
    cancelRequests: make("cancelRequests"),
    clearQueryCache: make("clearQueryCache"),
    clearStorage: make("clearStorage"),
    deleteFiles: make("deleteFiles"),
    clearSecrets: make("clearSecrets"),
    clearCrashUser: make("clearCrashUser"),
    routeToSignIn: make("routeToSignIn"),
  };
}

describe("signOutWipe (design 9.3)", () => {
  it("runs every step in order", async () => {
    const log: string[] = [];
    const { failed } = await signOutWipe(steps(log));
    expect(failed).toEqual([]);
    expect(log).toEqual([
      "clearMemoryToken",
      "cancelRequests",
      "clearQueryCache",
      "clearStorage",
      "deleteFiles",
      "clearSecrets",
      "clearCrashUser",
      "routeToSignIn",
    ]);
  });

  it("keeps going when a step fails, so the token is still deleted and the user routed out", async () => {
    const log: string[] = [];
    const { failed } = await signOutWipe(steps(log, ["clearStorage", "deleteFiles"]));
    expect(failed).toEqual(["clearStorage", "deleteFiles"]);
    expect(log).toContain("clearSecrets");
    expect(log.at(-1)).toBe("routeToSignIn");
  });
});
