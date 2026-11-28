import { act, renderHook } from "@testing-library/react-native";
import { ApiError } from "./api/client";
import { useAction } from "./useAction";

describe("useAction", () => {
  it("maps field errors and problem codes to plain messages", async () => {
    const fn = jest.fn().mockRejectedValue(
      new ApiError({
        type: "/problems/invalid",
        title: "t",
        status: 400,
        errors: [{ field: "new_password", code: "breached" }],
      }),
    );
    const { result } = await renderHook(() => useAction(fn, "password-change"));
    await act(async () => {
      await result.current.exec("a", "b");
    });
    expect(result.current.fields.new_password).toMatch(/leaked passwords/);
    expect(result.current.error).toBeNull();
  });

  it("explains a wrong current password", async () => {
    const fn = jest
      .fn()
      .mockRejectedValue(
        new ApiError({ type: "/problems/current-password-incorrect", title: "t", status: 403 }),
      );
    const { result } = await renderHook(() => useAction(fn));
    await act(async () => {
      await result.current.exec();
    });
    expect(result.current.error).toBe("Your current password is incorrect.");
  });
});
