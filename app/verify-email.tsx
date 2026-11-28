import { TokenPasswordScreen } from "@/features/auth/TokenPasswordScreen";
import { confirmEmailVerification } from "@/lib/api/auth";
import { strings } from "@/strings";

/** Email confirmation link (spec 0012 M2, AC2): asks for the password before confirming. */
export default function VerifyEmail() {
  return (
    <TokenPasswordScreen
      route="verify-email"
      context="verify"
      title={strings.verify.title}
      intro={`${strings.verify.intro} ${strings.verify.needsPassword}`}
      noToken={strings.verify.noToken}
      doneTitle={strings.verify.doneTitle}
      doneBody={strings.verify.doneBody}
      passwordLabel={strings.auth.password}
      submitLabel={strings.verify.submit}
      submit={confirmEmailVerification}
    />
  );
}
