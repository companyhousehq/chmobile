import { fireEvent, render, screen } from "@testing-library/react-native";
import { ClientsScreen } from "./ClientsScreen";
import * as authz from "@/lib/api/authorizations";
import * as ws from "@/lib/api/workspaces";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
  useLocalSearchParams: () => ({ workspaceId: "w1" }),
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("@/lib/api/workspaces", () => ({ useWsContext: jest.fn() }));
jest.mock("@/lib/api/queries", () => ({
  useMe: () => ({ data: { id: "u1", email_verified: true } }),
}));
jest.mock("@/lib/api/authorizations", () => ({
  useWorkspaceClients: jest.fn(),
  useWorkspaceRequests: jest.fn(),
  useCatalogue: jest.fn(),
  useRefreshClients: () => jest.fn(),
  authApi: {},
  keyForBody: () => "k",
}));
const w = ws as jest.Mocked<typeof ws>;
const a = authz as jest.Mocked<typeof authz>;

const q = <T,>(data: T) =>
  ({ data, isPending: false, isSuccess: true, error: null, refetch: jest.fn() }) as never;

const item = (id: string, name: string, scopes: string[]) => ({
  company: { id, legal_name: name, primary_identifier: { identifier_display: "RC 100" } },
  authorization: {
    id: `a-${id}`,
    status: "active",
    action_scopes: scopes,
    service_categories: ["cac"],
    expires_at: null,
  },
});

function setup(permissions: string[]) {
  w.useWsContext.mockReturnValue(
    q({ workspace_id: "w1", membership_id: "m", role: { id: "r", name: "R" }, permissions }),
  );
  a.useWorkspaceClients.mockReturnValue(
    q([
      item("c1", "Acme Ltd", ["company_profile.update"]),
      item("c2", "Zed Foods", ["company_profile.read"]),
    ]),
  );
  a.useWorkspaceRequests.mockReturnValue(
    q([
      {
        id: "p1",
        status: "pending",
        company: { id: "c3", legal_name: "Pending Co" },
        requested_action_scopes: ["company_profile.read"],
        requested_service_categories: ["cac"],
        requested_at: "2026-11-01T00:00:00Z",
        request_expires_at: null,
        request_note: null,
      },
    ]),
  );
  a.useCatalogue.mockReturnValue(q(undefined));
}

describe("ClientsScreen", () => {
  beforeEach(() => mockPush.mockClear());

  it("shows summary cards, filters by search and opens a client", async () => {
    setup([
      "workspace.clients.read",
      "workspace.companies.resolve",
      "workspace.authorizations.request",
    ]);
    await render(<ClientsScreen />);
    expect(screen.getByText("Acme Ltd")).toBeTruthy();
    expect(screen.getByText("Zed Foods")).toBeTruthy();
    expect(screen.getByText("You can edit")).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText("Search clients"), "zed");
    expect(screen.queryByText("Acme Ltd")).toBeNull();
    await fireEvent.press(screen.getByText("Open"));
    expect(mockPush).toHaveBeenCalledWith("/w/w1/client/c2");
  });

  it("hides the find tab without permission to look companies up", async () => {
    setup(["workspace.clients.read"]);
    await render(<ClientsScreen />);
    expect(screen.queryByText("Find a company")).toBeNull();
  });

  it("lists a request with the no-access reminder, and offers cancel only to requesters", async () => {
    setup(["workspace.authorizations.request"]);
    await render(<ClientsScreen />);
    await fireEvent.press(screen.getByText(/^Requests/));
    expect(screen.getByText("Pending Co")).toBeTruthy();
    expect(screen.getByText("No access until the company approves.")).toBeTruthy();
    expect(screen.getByText("Cancel request")).toBeTruthy();
  });
});
