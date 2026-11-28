import type { FieldError, Problem } from "./types";

/**
 * Plain-language messages for API problem types (spec 0011 R6, R8). The app
 * owns its copy. Covers the codes needed first: sign-in, session, consent,
 * generic access and connectivity. Unknown types fall back to the API's
 * `title`, then to a generic line, so nothing ever shows a raw type.
 */

export type ProblemContext =
  | "generic"
  | "login"
  | "session"
  | "consent"
  | "signup"
  | "verify"
  | "email-change-confirm"
  | "reset"
  | "password-change"
  | "mfa"
  | "invite"
  | "member"
  | "leave"
  | "workspace-create"
  | "workspace-profile"
  | "role"
  | "company"
  | "company-leave"
  | "claim"
  | "authorization";

type ProblemLike = Pick<Problem, "type" | "status"> &
  Partial<Pick<Problem, "title" | "retry_after_seconds">>;

export function problemSlug(type: string): string {
  return type.replace(/^\/?problems\//, "");
}

function waitText(seconds?: number): string {
  if (!seconds || seconds <= 60) return "a minute";
  return `${Math.ceil(seconds / 60)} minutes`;
}

export function problemMessage(p: ProblemLike, ctx: ProblemContext = "generic"): string {
  switch (problemSlug(p.type)) {
    case "unavailable":
      return "We can't reach Company House right now. Check your connection and try again.";
    case "too-many-attempts":
      return `Too many attempts. Wait ${waitText(p.retry_after_seconds)} and try again.`;
    case "invalid-credentials":
      return "That email and password don't match. Check them and try again.";
    case "account-suspended":
      return "This account is suspended. Contact Company House support to restore access.";
    case "email-unverified":
      return "Confirm your email address first. Check your inbox for the link we sent.";
    case "token-invalid":
      if (ctx === "verify" || ctx === "email-change-confirm") {
        return "This link has expired or was already used, or the password is wrong.";
      }
      return "This link has expired or was already used. Ask for a new one.";
    case "current-password-incorrect":
      return "Your current password is incorrect.";
    case "invalid-factor-code":
      return "That code didn't match. Check your authenticator app or recovery code and try again.";
    case "mfa-already-enabled":
      return "Two-factor authentication is already turned on for this account.";
    case "mfa-not-enabled":
      return "Two-factor authentication isn't turned on for this account.";
    case "factor-not-pending":
      return "This setup step expired or was already finished. Start again for a fresh code.";
    case "mfa-required-for-role":
      return "Your Company House staff role requires two-factor authentication, so it can't be turned off.";
    case "email-unavailable":
      return "This email change can no longer be completed. Start a new change from your account.";
    case "factor-required":
      return "Complete two-factor verification to continue.";
    case "factor-setup-required":
      return "Set up two-factor authentication to continue.";
    case "consent-outdated":
      return "Our Terms or Privacy Policy changed. Review the latest versions and accept them to continue.";
    case "consent-required":
      return "Our Terms or Privacy Policy changed. Review and accept them to continue.";
    case "unauthenticated":
      return ctx === "login"
        ? "That email and password don't match. Check them and try again."
        : "Your session has ended. Sign in again.";
    case "app-update-required":
      return "This version of the app is no longer supported. Update it to continue.";
    case "client-identification-required":
      return "This app version can't connect. Update the app and try again.";
    case "client-platform-unsupported":
      return "This app can't run on this kind of device. Use the website instead.";
    case "push-device-not-registered":
      return "This device isn't set up for notifications. Turn them on again in settings.";
    case "upload-in-progress":
      return "This file is still uploading. Wait for it to finish and try again.";
    case "upload-expired":
      return "This upload took too long and was cancelled. Choose the file and upload it again.";
    case "idempotency-key-reused":
      return "That request was already sent with different details. Refresh and try again.";
    case "client-ip-required":
      return "We couldn't confirm where this request came from. Try again in a moment.";
    case "personal-workspace-exists":
      return "You already have a personal workspace. Create an agency workspace to work with a team.";
    case "personal-workspace":
      return ctx === "role"
        ? "Personal workspaces can't have custom roles. Create an agency workspace to work with a team."
        : "Personal workspaces are just for you. Create an agency workspace to work with a team.";
    case "builtin-role-immutable":
      return "Starter roles can't be edited or archived. Duplicate one to create a custom role.";
    case "permission-not-grantable":
      return "You can't include access you don't hold yourself, and Owner controls stay on the built-in Owner role.";
    case "role-not-manageable":
      return "You can only change custom roles whose access stays within your own.";
    case "role-name-taken":
      return "A role with that name already exists in this workspace. Choose a different name.";
    case "custom-role-limit-reached":
      return "This workspace has reached the limit of 25 active custom roles. Archive an unused custom role first.";
    case "cannot-modify-own-role":
      return "You can't edit or archive the role currently assigned to you. Ask an Owner to change it.";
    case "cannot-change-own-role":
      return "You can't change your own role. Ask an Owner to change it.";
    case "role-in-use":
      return "This role is still assigned to a member or pending invitation. Reassign them or cancel the invitation first.";
    case "last-owner":
      if (ctx === "company" || ctx === "company-leave") {
        return ctx === "company-leave"
          ? "You're the only active Owner. Make another member an Owner first, then you can leave."
          : "A company must keep at least one active Owner. Make someone else an Owner first.";
      }
      return ctx === "leave"
        ? "You're the only active Owner. Make another member an Owner first, then you can leave."
        : "This would leave the workspace without an active Owner. Make someone else an Owner first.";
    case "role-not-assignable":
      return "You can't give this role. Only Owners can make or change Owners, and you can only give access you have yourself.";
    case "already-member":
      return "Already a member of this workspace.";
    case "invitation-not-pending":
      return "This invitation is no longer open. It may have been accepted, cancelled or replaced by a newer one.";
    case "membership-removed":
      return "This person was removed from the workspace. Send a new invitation to bring them back.";
    case "membership-not-suspended":
      return "This member isn't suspended.";
    case "workspace-verified":
    case "workspace-verification-locked":
      return "Your workspace name, business type and CAC registration are locked while verification is pending or verified.";
    case "workspace-registration-conflict":
      return "That registration number is already used by another workspace.";
    case "invitation-not-found":
      return "This invitation doesn't exist or isn't addressed to you.";
    case "open-claim-limit":
      return "You have three open claims already. Withdraw one or wait for a decision before starting another.";
    case "company-invitation-pending":
      return "You have an invitation to join this company. Accept it instead of claiming.";
    case "company-identifier-missing":
      return "This company has no registration number on record yet, so it can't be claimed.";
    case "already-responded":
      return "You already replied to this claim.";
    case "profile-version-conflict":
      return "Someone changed the profile while you were editing. Reload and try again.";
    case "draft-conflict":
      return "Someone else changed these answers while you were editing. Reload and try again.";
    case "questionnaire-outdated":
      return "A newer questionnaire is available. Reload to continue.";
    case "nothing-to-complete":
      return "There are no changes to complete since the last saved version.";
    case "file-too-large":
      return "That file is over 10 MB. Choose a smaller file or take a photo.";
    case "unsupported-file-type":
      return "Only PDF, PNG and JPEG files are accepted.";
    case "membership-not-active":
      return "This member isn't active.";
    case "authorization-scope-required":
      return "Your workspace's access to this company doesn't cover that.";
    case "company-unclaimed":
      return "This company hasn't set up a Company Workspace yet, so nobody can approve access. Ask the owner to claim it first.";
    case "authorization-request-exists":
      return "You already have a request waiting for this company. Cancel it first if you want to send a different one.";
    case "authorization-already-active":
      return "Your workspace already has this access to the company.";
    case "authorization-pending-limit":
      return "Your workspace has 50 requests waiting. Cancel one before sending another.";
    case "authorization-not-pending":
      return "This request is no longer waiting. It may already have been answered, cancelled or expired.";
    case "authorization-not-active":
      return "This access has already ended.";
    case "authorization-cannot-expand":
      return "You can only give less access or an earlier end date here.";
    case "forbidden":
      return "Your role doesn't allow this. Ask an Owner of the company or workspace.";
    case "not-found":
      return ctx === "invite"
        ? "This invitation doesn't exist or isn't addressed to you."
        : "We couldn't find that. It may have been removed, or you no longer have access.";
    case "invalid":
      return "Some details need fixing. Check the highlighted fields.";
    default:
      if (p.status >= 500) return "Something went wrong on our side. Try again in a moment.";
      return p.title && p.title.trim().length > 0
        ? p.title
        : "That didn't work. Try again in a moment.";
  }
}

export function fieldMessage(field: string, code: string): string {
  const name = field.split(".").pop() ?? field;
  switch (code) {
    case "required":
      if (name === "email" || name === "new_email") return "Enter your email address.";
      if (name === "password" || name === "new_password") return "Enter a password.";
      if (name === "current_password") return "Enter your current password.";
      if (name === "full_name") return "Enter your full name.";
      if (name === "display_name") return "Enter a name for the workspace.";
      if (name === "name") return "Enter a name for the role.";
      if (name === "permissions") return "Select at least one permission for this role.";
      if (name === "role_id") return "Choose a role.";
      if (name === "recovery_code") return "Enter one of your recovery codes.";
      if (name === "code") return "Enter the 6-digit code from your authenticator app.";
      return "This field is required.";
    case "invalid_email":
      return "Enter a valid email address, like name@company.ng.";
    case "too_short":
      return "Use at least 12 characters.";
    case "too_long":
      return name.includes("password") ? "Use 128 characters or fewer." : "This is too long.";
    case "breached":
      return "This password appears in lists of leaked passwords that attackers try first. Choose a different one.";
    case "same_as_email":
      return "Don't use your email address as your password.";
    case "invalid_phone":
      return "Enter a valid phone number, like 0803 123 4567.";
    case "consent_required":
      return "Accept the Terms of Service and Privacy Policy to continue.";
    case "baseline_required":
      return "Every role must include View workspace profile so members can open the workspace.";
    case "unknown_permission":
      return "One of the selected permissions isn't available for workspace roles.";
    case "not_allowed":
      return "Registration details apply only to businesses registered with CAC.";
    case "prefix_mismatch":
      return "That registration prefix doesn't match the selected entity type (RC for Company, BN for Business Name, IT for Incorporated Trustee).";
    case "invalid_cac_number":
      return "Enter digits only after the CAC prefix (for example, RC 123456 or 123456).";
    case "invalid_date":
      return "Enter the date as year-month-day, like 2019-03-27.";
    case "unknown_type":
      return "Choose what kind of document you are adding.";
    case "file_required":
      return "This kind of evidence needs a file or photo.";
    case "file_or_reference_required":
      return "Add a file or a reference.";
    case "too_many":
      return "You can add up to 10 items.";
    case "unknown_upload":
      return "A page didn't upload. Send again to retry it.";
    case "must_be_future":
      return "Choose a date in the future.";
    case "no_changes":
      return "Change something before saving.";
    default:
      return "Check this field.";
  }
}

/** Maps API field paths to a message each; the first error per field wins. */
export function mapFieldErrors(errors: FieldError[] | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const e of errors ?? []) {
    const key = e.field.replaceAll(".", "_");
    if (!out[key]) out[key] = fieldMessage(e.field, e.code);
  }
  return out;
}
