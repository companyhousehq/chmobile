import { render, screen } from "@testing-library/react-native";
import { TeamScreen } from "./TeamScreen";
import * as ws from "@/lib/api/workspaces";

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ workspaceId: "w1" }),
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("@/lib/api/workspaces", () => ({
  useWsContext: jest.fn(),
  useWorkspace: jest.fn(),
  useMembers: jest.fn(),
  useInvitations: jest.fn(),
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

const members = [
  {
    id: "me",
    user: { id: "u1", full_name: "Ada Obi", email: "ada@x.ng" },
    role: { id: "r-owner", key: "owner", name: "Owner" },
    status: "active",
    joined_at: "",
  },
  {
    id: "m2",
    user: { id: "u2", full_name: "Bayo Eze" },
    role: { id: "r-fin", key: "finance", name: "Finance" },
    status: "active",
    joined_at: "",
  },
];
const roles = [
  {
    id: "r-owner",
    key: "owner",
    name: "Owner",
    builtin: true,
    permissions: ["workspace.members.manage", "workspace.owners.manage"],
  },
  { id: "r-fin", key: "finance", name: "Finance", builtin: true, permissions: [] },
];

function setup(permissions: string[]) {
  m.useWsContext.mockReturnValue(
    q({
      workspace_id: "w1",
      membership_id: "me",
      role: { id: "r-owner", name: "Owner" },
      permissions,
    }),
  );
  m.useWorkspace.mockReturnValue(q({ id: "w1", type: "agency", display_name: "Agency" }));
  m.useMembers.mockReturnValue(q(members));
  m.useInvitations.mockReturnValue(q([]));
  m.useRoles.mockReturnValue(q(roles));
  m.useRefreshWorkspace.mockReturnValue(jest.fn());
}

describe("TeamScreen", () => {
  it("shows invite and action controls to a member manager, and hides contact without read_contact", async () => {
    setup([
      "workspace.members.read",
      "workspace.members.invite",
      "workspace.members.manage",
      "workspace.owners.manage",
    ]);
    await render(<TeamScreen />);
    expect(screen.getByText("Invite someone")).toBeTruthy();
    expect(screen.getByLabelText("Actions: Bayo Eze")).toBeTruthy();
    expect(screen.getByText("Contact details are hidden for your role.")).toBeTruthy();
  });

  it("shows a read-only viewer no invite control and no member actions", async () => {
    setup(["workspace.members.read"]);
    await render(<TeamScreen />);
    expect(screen.queryByText("Invite someone")).toBeNull();
    expect(screen.queryByLabelText("Actions: Bayo Eze")).toBeNull();
    expect(screen.getByText("Bayo Eze")).toBeTruthy();
  });
});
