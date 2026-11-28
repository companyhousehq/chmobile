import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { ApiError } from "@/lib/api/client";
import { verifyMfa } from "@/lib/api/auth";
import { MfaChallenge } from "./MfaChallenge";

jest.mock("@/lib/api/auth", () => ({ verifyMfa: jest.fn() }));
const verify = verifyMfa as jest.Mock;

beforeEach(() => verify.mockReset());

describe("MfaChallenge", () => {
  it("submits a six-digit code and reports the remaining requirements", async () => {
    verify.mockResolvedValue({ requirements: ["consent"] });
    const onVerified = jest.fn();
    await render(<MfaChallenge onVerified={onVerified} />);
    await fireEvent.changeText(screen.getByLabelText("6-digit code"), "123 456");
    await waitFor(() => expect(onVerified).toHaveBeenCalledWith(["consent"]));
    expect(verify).toHaveBeenCalledWith({ code: "123456" });
  });

  it("switches to a recovery code and sends it as recovery_code", async () => {
    verify.mockResolvedValue({ requirements: [] });
    const onVerified = jest.fn();
    await render(<MfaChallenge onVerified={onVerified} />);
    await fireEvent.press(screen.getByText("Use a recovery code instead"));
    await fireEvent.changeText(screen.getByLabelText("Recovery code"), "abcd-efgh");
    await fireEvent.press(screen.getByLabelText("Verify"));
    await waitFor(() => expect(onVerified).toHaveBeenCalled());
    expect(verify).toHaveBeenCalledWith({ recovery_code: "abcd-efgh" });
  });

  it("shows the throttle wait and refuses further attempts until it passes", async () => {
    verify.mockRejectedValue(
      new ApiError({
        type: "/problems/too-many-attempts",
        title: "x",
        status: 429,
        retry_after_seconds: 300,
      }),
    );
    await render(<MfaChallenge onVerified={jest.fn()} />);
    await fireEvent.changeText(screen.getByLabelText("6-digit code"), "111111");
    await screen.findByText(/You can try again in 5 minutes/);
    await fireEvent.changeText(screen.getByLabelText("6-digit code"), "222222");
    expect(verify).toHaveBeenCalledTimes(1);
  });
});
