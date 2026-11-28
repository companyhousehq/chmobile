import { fireEvent, render, screen } from "@testing-library/react-native";
import * as LocalAuthentication from "expo-local-authentication";
import { Text } from "react-native";
import { setLockEnabled } from "@/lib/lockSettings";
import { LockGate } from "./LockGate";

const mockWipe = jest.fn();
jest.mock("./SessionProvider", () => ({
  useSession: () => ({ status: "signedIn", wipe: mockWipe }),
}));
jest.mock("expo-local-authentication", () => ({ authenticateAsync: jest.fn() }));

const authenticate = LocalAuthentication.authenticateAsync as jest.Mock;

async function renderGate() {
  return await render(
    <LockGate>
      <Text>secret content</Text>
    </LockGate>,
  );
}

beforeEach(() => {
  mockWipe.mockReset();
  authenticate.mockReset();
});

describe("LockGate", () => {
  it("passes through when the lock is off", async () => {
    setLockEnabled(false);
    await renderGate();
    expect(screen.getByText("secret content")).toBeTruthy();
  });

  it("hides content on cold start until the device unlocks", async () => {
    setLockEnabled(true);
    authenticate.mockResolvedValue({ success: true });
    await renderGate();
    expect(screen.queryByText("secret content")).toBeNull();

    await fireEvent.press(screen.getByRole("button", { name: "Unlock" }));
    expect(screen.getByText("secret content")).toBeTruthy();
  });

  it("signs out with the full wipe after five failed unlocks", async () => {
    setLockEnabled(true);
    authenticate.mockResolvedValue({ success: false, error: "authentication_failed" });
    await renderGate();
    for (let i = 0; i < 5; i++) {
      await fireEvent.press(screen.getByRole("button", { name: "Unlock" }));
    }
    expect(mockWipe).toHaveBeenCalledTimes(1);
    setLockEnabled(false);
  });
});
