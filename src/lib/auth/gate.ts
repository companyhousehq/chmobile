/**
 * Session gates (spec 0012 M3, M6, M11). After sign-in the API may still ask
 * for a factor, a factor enrolment or newer consent; until then only the gate
 * screen and sign-out are reachable. The server decides; this maps its words.
 */
export type Gate = "factor" | "factor_setup" | "consent" | "unknown";

const ORDER: Gate[] = ["factor", "factor_setup", "consent"];

/** The first outstanding requirement, in the order the API enforces them. */
export function gateFromRequirements(requirements: readonly string[] | undefined): Gate | null {
  for (const g of ORDER) if (requirements?.includes(g)) return g;
  return null;
}

/** After GET /v1/me/mfa on a 403 factor-required: which factor screen. */
export function gateFromMfaStage(stage: string): Gate | null {
  if (stage === "factor_required") return "factor";
  if (stage === "factor_setup_required") return "factor_setup";
  return null;
}
