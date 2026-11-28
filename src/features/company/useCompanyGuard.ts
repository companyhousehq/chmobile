import { useCompanyContext } from "@/lib/api/companies";
import { clearActivityDraft, clearClaimDraft } from "@/lib/companyDrafts";
import { useLossGuard } from "@/lib/context/useLossGuard";
import { strings } from "@/strings";

/**
 * A member removed from a company while the app shows it gets 404 on the next
 * load (spec 0012 AC36), from the context query or from any other request
 * under the company. The app drops that company from its caches, cached
 * context lists and drafts and moves on to the next context (0011 R4).
 */
export function useCompanyGuard(companyId: string): void {
  const ctx = useCompanyContext(companyId);
  useLossGuard({ kind: "company", id: companyId }, ctx, strings.co.lost, (userId) => {
    clearActivityDraft(userId, companyId);
    clearClaimDraft(userId, companyId);
  });
}
