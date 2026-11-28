import { useCompanyId } from "@/features/company/useCompanyId";
import { useCompanyContext } from "@/lib/api/companies";
import { hiddenCompanyTabs } from "@/lib/tabs";
import { strings } from "@/strings";
import { ContextTabs } from "@/ui/ContextTabs";

/** Company context tabs (spec 0012 Navigation). */
export default function CompanyTabs() {
  const companyId = useCompanyId();
  const ctx = useCompanyContext(companyId);
  const hidden = hiddenCompanyTabs(ctx.data?.permissions);
  return (
    <ContextTabs
      context={{ kind: "company", id: companyId }}
      tabs={[
        { name: "index", title: strings.tabs.home, icon: "home-outline" },
        {
          name: "profile",
          hidden: hidden.has("profile"),
          title: strings.tabs.profile,
          icon: "business-outline",
        },
        {
          name: "people",
          hidden: hidden.has("people"),
          title: strings.tabs.people,
          icon: "people-outline",
        },
        {
          name: "agents",
          hidden: hidden.has("agents"),
          title: strings.tabs.agents,
          icon: "shield-checkmark-outline",
        },
        { name: "you", title: strings.tabs.you, icon: "person-circle-outline" },
      ]}
    />
  );
}
