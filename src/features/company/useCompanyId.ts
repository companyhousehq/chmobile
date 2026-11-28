import { useLocalSearchParams } from "expo-router";
import { createContext, useContext } from "react";

/**
 * The company of the enclosing `c/[companyId]` layout. Tab screens read it
 * from here: a tab press navigates without the parent's params, so their own
 * search params lack `companyId` and every query would stay disabled.
 */
export const CompanyIdContext = createContext<string | null>(null);

export function useCompanyId(): string {
  const fromLayout = useContext(CompanyIdContext);
  const { companyId } = useLocalSearchParams<{ companyId: string }>();
  return fromLayout ?? companyId ?? "";
}
