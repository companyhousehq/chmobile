import { TokenPasswordScreen } from "@/features/auth/TokenPasswordScreen";
import { confirmEmailChange } from "@/lib/api/auth";
import { strings } from "@/strings";

/** Email change link (spec 0012 M4): same handling as the verification link. */
export default function ConfirmEmailChange() {
  return (
    <TokenPasswordScreen
      route="confirm-email-change"
      context="email-change-confirm"
      title={strings.changeEmail.title}
      intro={strings.changeEmail.intro}
      noToken={strings.changeEmail.noToken}
      doneTitle={strings.changeEmail.doneTitle}
      doneBody={strings.changeEmail.doneBody}
      passwordLabel={strings.auth.password}
      submitLabel={strings.changeEmail.submit}
      submit={confirmEmailChange}
    />
  );
}
