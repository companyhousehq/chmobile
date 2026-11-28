import { render, screen } from "@testing-library/react-native";
import { CompanyAgentsScreen } from "./CompanyAgentsScreen";
import * as authz from "@/lib/api/authorizations";
import * as co from "@/lib/api/companies";

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ companyId: "c1" }),
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("@/lib/api/companies", () => ({ useCompanyContext: jest.fn() }));
jest.mock("@/lib/api/authorizations", () => ({
  useCompanyAuthorizations: jest.fn(),
  useCatalogue: jest.fn(),
}));
const c = co as jest.Mocked<typeof co>;
const a = authz as jest.Mocked<typeof authz>;

const q = <T,>(data: T) =>
  ({ data, isPending: false, isSuccess: true, error: null, refetch: jest.fn() }) as never;

const pending = {
  id: "11111111-1111-1111-1111-111111111111",
  company: { id: "c1", legal_name: "Acme Ltd" },
  workspace: {
    id: "w1",
    type: "agency",
    display_name: "Beta Advisers",
    verification_status: "verified",
    declared_service_categories: [],
    verified_credentials: [],
  },
  status: "pending",
  action_scopes: [],
  service_categories: [],
  requested_action_scopes: ["company_profile.update", "company_profile.read"],
  requested_service_categories: ["cac"],
  request_note: "Annual return",
  requested_by: { id: "u2", full_name: "Tolu Ade" },
  requested_at: "2026-11-01T00:00:00Z",
  request_expires_at: "2026-12-01T00:00:00Z",
  expires_at: null,
  updated_at: "2026-11-01T00:00:00Z",
};

function setup(permissions: string[]) {
  c.useCompanyContext.mockReturnValue(
    q({
      company_id: "c1",
      company_workspace_id: "w",
      membership_id: "m",
      role: { id: "r", name: "R" },
      permissions,
    }),
  );
  a.useCompanyAuthorizations.mockReturnValue(q([pending]));
  a.useCatalogue.mockReturnValue(q(undefined));
}

describe("CompanyAgentsScreen", () => {
  it("shows a request in plain words with no keys, ids or spec terms", async () => {
    setup(["company.authorizations.read", "company.authorizations.approve"]);
    await render(<CompanyAgentsScreen />);
    expect(screen.getByText("Beta Advisers")).toBeTruthy();
    expect(screen.getByText("Verified agency")).toBeTruthy();
    expect(screen.getByText("• Edit company details and business activities")).toBeTruthy();
    expect(screen.getByText('"Annual return"')).toBeTruthy();
    expect(screen.queryByText(/company_profile/)).toBeNull();
    expect(screen.queryByText(/1111-1111/)).toBeNull();
    expect(screen.getByText(/independent, not CAC or a government agency/)).toBeTruthy();
  });

  it("gives an approver the Allow someone control", async () => {
    setup(["company.authorizations.read", "company.authorizations.approve"]);
    await render(<CompanyAgentsScreen />);
    expect(screen.getByText("Allow someone")).toBeTruthy();
    expect(screen.queryByText(/Only a Director or Owner/)).toBeNull();
  });

  it("gives other members the lists with no allow control", async () => {
    setup(["company.authorizations.read"]);
    await render(<CompanyAgentsScreen />);
    expect(screen.getByText("Beta Advisers")).toBeTruthy();
    expect(screen.queryByText("Allow someone")).toBeNull();
    expect(screen.getByText(/Only a Director or Owner/)).toBeTruthy();
  });
});
