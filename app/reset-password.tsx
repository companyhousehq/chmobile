import { TokenPasswordScreen } from "@/features/auth/TokenPasswordScreen";
import { confirmPasswordReset } from "@/lib/api/auth";
import { strings } from "@/strings";

/** Password reset link: choose a new password (0001 R7). */
export default function ResetPassword() {
  return (
    <TokenPasswordScreen
      route="reset-password"
      context="reset"
      title={strings.reset.title}
      intro={strings.reset.intro}
      noToken={strings.reset.noToken}
      doneTitle={strings.reset.doneTitle}
      doneBody={strings.reset.doneBody}
      passwordLabel={strings.reset.newPassword}
      submitLabel={strings.reset.submit}
      submit={confirmPasswordReset}
      newPassword
    />
  );
}
