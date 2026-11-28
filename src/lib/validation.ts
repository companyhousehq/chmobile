/** Input helpers owned by the app (spec 0011 R8). Pure functions. */

const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export function isEmail(value: string): boolean {
  return value.length <= 254 && EMAIL_RE.test(value);
}

/**
 * Normalises a Nigerian phone number to E.164 (the API requires "+234...").
 * Other numbers are returned trimmed so the API can validate them.
 */
export function normalizePhone(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const compact = trimmed.replace(/[\s\-().]/g, "");
  if (/^\+\d+$/.test(compact)) return compact;
  if (/^0\d{10}$/.test(compact)) return `+234${compact.slice(1)}`;
  if (/^[789]\d{9}$/.test(compact)) return `+234${compact}`;
  if (/^234\d{10}$/.test(compact)) return `+${compact}`;
  return compact;
}

export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;

export interface PasswordCheck {
  length: number;
  longEnough: boolean;
  tooLong: boolean;
  sameAsEmail: boolean;
}

/** Mirrors the API policy that can be checked locally; the leaked-password list is the API's. */
export function checkPassword(password: string, email = ""): PasswordCheck {
  const length = [...password.normalize("NFC")].length;
  return {
    length,
    longEnough: length >= PASSWORD_MIN,
    tooLong: length > PASSWORD_MAX,
    sameAsEmail: email !== "" && password.trim().toLowerCase() === email.trim().toLowerCase(),
  };
}

/** A six-digit authenticator code, spaces ignored. */
export function normalizeTotp(value: string): string {
  return value.replace(/\D/g, "").slice(0, 6);
}

/** Recovery codes are typed as shown; case and surrounding space do not matter. */
export function normalizeRecoveryCode(value: string): string {
  return value.trim();
}
