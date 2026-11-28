import { render, screen } from "@testing-library/react-native";
import { PeopleScreen } from "./PeopleScreen";
import * as co from "@/lib/api/companies";

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ companyId: "c1" }),
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("@/lib/api/companies", () => ({
  useCompanyContext: jest.fn(),
  useCompanyMembers: jest.fn(),
  useCompanyInvites: jest.fn(),
  useCompanyRoles: jest.fn(),
  useRefreshCompany: jest.fn(),
  companyApi: {},
}));
const m = co as jest.Mocked<typeof co>;

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
    role: { id: "r-view", key: "viewer", name: "Viewer" },
    status: "active",
    joined_at: "",
  },
];
const roles = [
  {
    id: "r-owner",
    key: "owner",
    name: "Owner",
    permissions: ["company.members.manage", "company.owners.manage"],
  },
  { id: "r-view", key: "viewer", name: "Viewer", permissions: [] },
];

function setup(permissions: string[]) {
  m.useCompanyContext.mockReturnValue(
    q({
      company_id: "c1",
      company_workspace_id: "w",
      membership_id: "me",
      role: { id: "r-owner", name: "Owner" },
      permissions,
    }),
  );
  m.useCompanyMembers.mockReturnValue(q(members));
  m.useCompanyInvites.mockReturnValue(q([]));
  m.useCompanyRoles.mockReturnValue(q(roles));
  m.useRefreshCompany.mockReturnValue(jest.fn());
}

describe("company PeopleScreen", () => {
  it("gives an Owner invite, member actions and claim notices", async () => {
    setup([
      "company.members.read",
      "company.members.invite",
      "company.members.manage",
      "company.owners.manage",
    ]);
    await render(<PeopleScreen />);
    expect(screen.getByText("Invite someone")).toBeTruthy();
    expect(screen.getByLabelText("Actions: Bayo Eze")).toBeTruthy();
    expect(screen.getByText("Claim notices")).toBeTruthy();
    expect(screen.getByText("Contact details are hidden for your role.")).toBeTruthy();
  });

  it("gives a Viewer the list with no invite, actions or claim notices", async () => {
    setup(["company.members.read"]);
    await render(<PeopleScreen />);
    expect(screen.getByText("Bayo Eze")).toBeTruthy();
    expect(screen.queryByText("Invite someone")).toBeNull();
    expect(screen.queryByLabelText("Actions: Bayo Eze")).toBeNull();
    expect(screen.queryByText("Claim notices")).toBeNull();
  });
});
