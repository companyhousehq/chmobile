import { fireEvent, render, screen } from "@testing-library/react-native";
import { ActivityScreen } from "./ActivityScreen";
import * as co from "@/lib/api/companies";
import { ApiError } from "@/lib/api/client";
import type { ActivityView } from "@/lib/company";
import { loadActivityDraft } from "@/lib/companyDrafts";
import fixtures from "@/lib/questionnaire.fixtures.json";
import type { QuestionnaireDefinition } from "@/lib/questionnaire";

jest.mock("expo-router", () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ companyId: "c1" }),
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("expo-file-system", () => ({ File: class {}, Directory: class {}, Paths: {} }));
jest.mock("@/lib/api/queries", () => ({
  useMe: () => ({ data: { id: "u1" }, isPending: false, error: null, refetch: jest.fn() }),
}));
jest.mock("@/lib/api/companies", () => ({
  useActivity: jest.fn(),
  useCompanyContext: jest.fn(),
  useRefreshCompany: jest.fn(),
  companyApi: { saveDraft: jest.fn(), complete: jest.fn() },
}));
const m = co as jest.Mocked<typeof co>;

const q = <T,>(data: T) =>
  ({ data, isPending: false, isSuccess: true, error: null, refetch: jest.fn() }) as never;

const view: ActivityView = {
  status: "not_started",
  questionnaire: {
    id: "qv1",
    version: 1,
    definition: fixtures.definition as unknown as QuestionnaireDefinition,
  },
  newer_questionnaire_available: false,
  draft: null,
  current: null,
};

function setup(permissions: string[]) {
  m.useActivity.mockReturnValue(q(view));
  m.useCompanyContext.mockReturnValue(
    q({
      company_id: "c1",
      company_workspace_id: "w",
      membership_id: "me",
      role: { id: "r", name: "R" },
      permissions,
    }),
  );
  m.useRefreshCompany.mockReturnValue(jest.fn());
}

describe("ActivityScreen", () => {
  it("is read-only for a member without company.activity_profile.update and says answers are declared", async () => {
    setup(["company.profile.read"]);
    await render(<ActivityScreen />);
    expect(screen.getByText("Your role can view these answers but not change them.")).toBeTruthy();
    expect(screen.queryByText("Start")).toBeNull();
    expect(screen.getByText("Declared by your company")).toBeTruthy();
    expect(screen.getByText("Version history")).toBeTruthy();
  });

  it("shows one section per screen with a progress bar, (basics, people, review)", async () => {
    setup(["company.profile.read", "company.activity_profile.update"]);
    await render(<ActivityScreen />);
    await fireEvent.press(screen.getByText("Start"));
    expect(screen.getByText(/Step 1 of 3/)).toBeTruthy();
    expect(screen.getByRole("progressbar")).toBeTruthy();
  });

  it("keeps an unsent step as a device draft when offline and never shows it as saved", async () => {
    setup(["company.profile.read", "company.activity_profile.update"]);
    (co.companyApi.saveDraft as jest.Mock).mockRejectedValue(
      new ApiError({ type: "/problems/unavailable", title: "", status: 0 }),
    );
    await render(<ActivityScreen />);
    await fireEvent.press(screen.getByText("Start"));
    await fireEvent.changeText(screen.getByLabelText("Name"), "Acme");
    await fireEvent.press(screen.getByText("Save and continue"));
    expect(await screen.findByText(/You're offline\. This step isn't saved/)).toBeTruthy();
    expect(screen.getByText(/Not saved yet/)).toBeTruthy();
    expect(screen.queryByText(/Saved to Company House/)).toBeNull();
    expect(loadActivityDraft("u1", "c1")?.answers).toMatchObject({ name: "Acme" });
  });
});
