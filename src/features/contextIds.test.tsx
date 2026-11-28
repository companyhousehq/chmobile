import { renderHook } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { CompanyIdContext, useCompanyId } from "./company/useCompanyId";
import { WorkspaceIdContext, useWorkspaceId } from "./workspace/useWorkspaceId";

const params: Record<string, string> = {};
jest.mock("expo-router", () => ({ useLocalSearchParams: () => params }));

// A tab press navigates without the parent's params (D3), so the id must come
// from the enclosing layout even when the screen's own params are empty.
describe("context ids", () => {
  it("reads the company from the layout when the tab has no params", async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <CompanyIdContext.Provider value="co_1">{children}</CompanyIdContext.Provider>
    );
    const { result } = await renderHook(() => useCompanyId(), { wrapper });
    expect(result.current).toBe("co_1");
  });

  it("reads the workspace from the layout when the tab has no params", async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <WorkspaceIdContext.Provider value="ws_1">{children}</WorkspaceIdContext.Provider>
    );
    const { result } = await renderHook(() => useWorkspaceId(), { wrapper });
    expect(result.current).toBe("ws_1");
  });

  it("falls back to route params outside a context layout", async () => {
    params.companyId = "co_2";
    const { result } = await renderHook(() => useCompanyId());
    expect(result.current).toBe("co_2");
  });
});
