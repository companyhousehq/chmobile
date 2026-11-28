import { fireEvent, render, screen } from "@testing-library/react-native";
import { FindCompanyScreen } from "./FindCompanyScreen";
import { companyApi } from "@/lib/api/companies";

jest.mock("expo-router", () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("@/lib/api/claimFlow", () => ({ newKey: () => "key" }));
jest.mock("@/lib/api/queries", () => ({
  useMe: () => ({ data: { id: "u1", email_verified: true } }),
}));
jest.mock("@/lib/api/companies", () => ({ companyApi: { resolve: jest.fn() } }));

const summary = {
  id: "c1",
  legal_name: "Acme Ltd",
  entity_type: "company",
  jurisdiction: "NG",
  identity_status: "canonical",
  verification_status: "unverified",
  primary_identifier: {
    registration_authority: "CAC",
    entity_type: "company",
    identifier_display: "RC 123456",
    verification_status: "unverified",
  },
};

async function toStepTwo() {
  await render(<FindCompanyScreen />);
  await fireEvent.press(screen.getByText("Continue"));
}

describe("FindCompanyScreen", () => {
  beforeEach(() => jest.resetAllMocks());

  it("previews the normalised registration number as you type", async () => {
    await toStepTwo();
    await fireEvent.changeText(screen.getByLabelText("Registration number"), "rc 123-456");
    expect(screen.getByText("We will look for RC 123456")).toBeTruthy();
  });

  it("says finding a company gives no access and that Company House is not CAC, before and after the result", async () => {
    (companyApi.resolve as jest.Mock).mockResolvedValue({
      outcome: "matched_unverified",
      company: summary,
    });
    await toStepTwo();
    expect(screen.getByText(/doesn't give you access/)).toBeTruthy();
    expect(screen.getByText(/not CAC or a government agency/)).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText("Registration number"), "RC 123456");
    await fireEvent.changeText(screen.getByLabelText("Legal name"), "Acme Ltd");
    await fireEvent.press(screen.getByText("Look up company"));
    expect(await screen.findByText("This is my company")).toBeTruthy();
    expect(screen.getByText(/doesn't give you access/)).toBeTruthy();
    expect(screen.getByText(/not CAC or a government agency/)).toBeTruthy();
  });

  it("offers 'this is a different company' for a possible duplicate and resends with confirm_distinct", async () => {
    const resolve = companyApi.resolve as jest.Mock;
    resolve.mockResolvedValueOnce({ outcome: "possible_duplicate", candidates: [summary] });
    resolve.mockResolvedValueOnce({ outcome: "created_provisional", company: summary });
    await toStepTwo();
    await fireEvent.changeText(screen.getByLabelText("Registration number"), "RC 123457");
    await fireEvent.changeText(screen.getByLabelText("Legal name"), "Acme Ltd");
    await fireEvent.press(screen.getByText("Look up company"));
    await fireEvent.press(await screen.findByText("This is a different company"));
    expect(await screen.findByText("We added this company")).toBeTruthy();
    expect(resolve.mock.calls.at(-1)[0]).toMatchObject({ confirmDistinct: true });
  });
});
