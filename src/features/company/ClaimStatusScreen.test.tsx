import { render, screen } from "@testing-library/react-native";
import { ClaimStatusScreen } from "./ClaimStatusScreen";
import * as co from "@/lib/api/companies";
import type { Claim } from "@/lib/company";

jest.mock("expo-router", () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ claimId: "cl1" }),
}));
jest.mock("@/ui/PrivacyScreen", () => ({
  PrivacyScreen: ({ children }: { children: unknown }) => children,
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("./evidenceMedia", () => ({}));
jest.mock("@/lib/api/claimFlow", () => ({ uploadPages: jest.fn(), newKey: () => "k" }));
jest.mock("@/lib/api/companies", () => ({
  useMyClaim: jest.fn(),
  useEvidenceTypes: jest.fn(),
  useRefreshMyCompanies: jest.fn(),
  companyApi: {},
}));
const m = co as jest.Mocked<typeof co>;

const q = <T,>(data: T) =>
  ({ data, isPending: false, isSuccess: true, error: null, refetch: jest.fn() }) as never;

const claim = (over: Partial<Claim>): Claim => ({
  id: "cl1",
  status: "under_review",
  closed_reason: null,
  company: {
    id: "c1",
    legal_name: "Acme Ltd",
    entity_type: "company",
    jurisdiction: "NG",
    identity_status: "canonical",
    verification_status: "verified",
  },
  capacity: "director",
  capacity_other: null,
  message: null,
  message_from_reviewer: null,
  response_due_at: null,
  approved_role: null,
  submitted_at: "2026-11-01T00:00:00Z",
  updated_at: "2026-11-01T00:00:00Z",
  decided_at: null,
  can_add_evidence: true,
  can_withdraw: true,
  evidence: [],
  ...over,
});

function setup(c: Claim) {
  m.useMyClaim.mockReturnValue(q(c));
  m.useEvidenceTypes.mockReturnValue(q([]));
  m.useRefreshMyCompanies.mockReturnValue(jest.fn());
}

describe("ClaimStatusScreen", () => {
  it("shows the reviewer message, add evidence, withdraw and the independence notice", async () => {
    setup(
      claim({
        status: "needs_information",
        message_from_reviewer: "Please add the CAC certificate.",
        response_due_at: "2026-12-01T00:00:00Z",
      }),
    );
    await render(<ClaimStatusScreen />);
    expect(screen.getByText("Please add the CAC certificate.")).toBeTruthy();
    expect(screen.getByText("Add evidence")).toBeTruthy();
    expect(screen.getByText("Withdraw claim")).toBeTruthy();
    expect(
      screen.getByText(
        "Company House is an independent service. It is not CAC or a government agency.",
      ),
    ).toBeTruthy();
  });

  it("offers no add-evidence or withdraw once the claim is decided, and still shows the notice", async () => {
    setup(claim({ status: "rejected", can_add_evidence: false, can_withdraw: false }));
    await render(<ClaimStatusScreen />);
    expect(screen.queryByText("Add evidence")).toBeNull();
    expect(screen.queryByText("Withdraw claim")).toBeNull();
    expect(screen.getByText("Not approved")).toBeTruthy();
    expect(screen.getByText(/independent service/)).toBeTruthy();
  });
});
