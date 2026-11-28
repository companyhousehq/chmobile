import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { InviteScreen } from "./InviteScreen";
import * as ws from "@/lib/api/workspaces";

const mockBack = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack }),
  useLocalSearchParams: () => ({ workspaceId: "w1" }),
  Stack: { Screen: () => null },
}));
jest.mock("@/lib/api/workspaces", () => ({
  useWsContext: jest.fn(),
  useRoles: jest.fn(),
  useRefreshWorkspace: jest.fn(),
  wsApi: {
    invite: jest.fn(),
    leave: jest.fn(),
    memberAction: jest.fn(),
    changeRole: jest.fn(),
    cancelInvitation: jest.fn(),
  },
}));
const m = ws as jest.Mocked<typeof ws>;
const q = <T,>(data: T) =>
  ({ data, isPending: false, isSuccess: true, error: null, refetch: jest.fn() }) as never;

const roles = [
  {
    id: "r-owner",
    key: "owner",
    name: "Owner",
    builtin: true,
    permissions: ["workspace.members.invite", "workspace.owners.manage"],
  },
  { id: "r-fin", key: "finance", name: "Finance", builtin: true, permissions: [] },
];

beforeEach(() => {
  mockBack.mockReset();
  m.useWsContext.mockReturnValue(
    q({
      workspace_id: "w1",
      membership_id: "me",
      role: { id: "r-admin", name: "Administrator" },
      permissions: ["workspace.members.invite"],
    }),
  );
  m.useRoles.mockReturnValue(q(roles));
  m.useRefreshWorkspace.mockReturnValue(jest.fn().mockResolvedValue(undefined));
  (m.wsApi.invite as unknown as jest.Mock).mockReset().mockResolvedValue({});
});

describe("InviteScreen", () => {
  it("does not offer Owner to an Administrator and invites as the default role", async () => {
    await render(<InviteScreen />);
    expect(screen.queryByText("Owner")).toBeNull();
    await fireEvent.changeText(screen.getByLabelText("Email address"), "new@x.ng");
    await fireEvent.press(screen.getByLabelText("Send invitation"));
    await waitFor(() => expect(m.wsApi.invite).toHaveBeenCalledWith("w1", "new@x.ng", "r-fin"));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });

  it("rejects a bad address before calling the API", async () => {
    await render(<InviteScreen />);
    await fireEvent.changeText(screen.getByLabelText("Email address"), "nope");
    await fireEvent.press(screen.getByLabelText("Send invitation"));
    await screen.findByText(/isn't a valid email address/);
    expect(m.wsApi.invite).not.toHaveBeenCalled();
  });
});
