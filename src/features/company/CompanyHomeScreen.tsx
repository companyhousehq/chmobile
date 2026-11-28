import { useRouter, type Href } from "expo-router";
import { useCompanyId } from "./useCompanyId";
import { useCompanyContext, useCompanyHome } from "@/lib/api/companies";
import { CPERM, companyEntityLabel } from "@/lib/company";
import { can } from "@/lib/workspace";
import { strings } from "@/strings";
import { Badge } from "@/ui/Badge";
import { Card } from "@/ui/Card";
import { IndependenceNotice } from "@/ui/IndependenceNotice";
import { Notice } from "@/ui/Notice";
import { QueryGate } from "@/ui/QueryGate";
import { Row } from "@/ui/Row";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";

const t = strings.co.home;

/** Company home: profile summary, questionnaire status and the claim-notice badge (M20). */
export function CompanyHomeScreen() {
  const id = useCompanyId();
  const router = useRouter();
  const ctx = useCompanyContext(id);
  const home = useCompanyHome(id);
  const perms = ctx.data?.permissions ?? [];
  const h = home.data;
  const activity = h?.activity_profile.status ?? "not_started";
  const statusText =
    activity === "complete"
      ? t.status.complete
      : activity === "draft"
        ? t.status.draft
        : t.status.none;
  const notices = h?.open_claim_notices ?? 0;

  return (
    <Screen edges={["bottom"]}>
      <QueryGate queries={[ctx, home]}>
        {h ? (
          <>
            <Text variant="title2" bold accessibilityRole="header">
              {h.company.legal_name}
            </Text>
            {ctx.data ? (
              <Text variant="footnote" tone="textMuted">
                {t.role(ctx.data.role.name)}
              </Text>
            ) : null}
            <Card>
              <Text variant="footnote" tone="textMuted" bold>
                {t.identity}
              </Text>
              <Text>{companyEntityLabel(h.company.entity_type)}</Text>
              {h.company.identifiers.map((i) => (
                <Text
                  key={`${i.registration_authority}:${i.identifier_display}`}
                  variant="footnote"
                  tone="text2"
                >
                  {i.identifier_display}
                </Text>
              ))}
              <Badge
                label={
                  h.company.verification_status === "verified"
                    ? strings.co.find.verified
                    : strings.co.find.unverified
                }
                tone={h.company.verification_status === "verified" ? "success" : "neutral"}
              />
            </Card>
            <IndependenceNotice />
            {h.owner_state === "ownerless" ? <Notice tone="warning">{t.ownerless}</Notice> : null}
            {can(perms, CPERM.ownersManage) && notices > 0 ? (
              <Row
                title={t.notices(notices)}
                hint={t.noticesHint}
                right={<Badge label={String(notices)} tone="warning" />}
                onPress={() => router.push(`/c/${id}/claim-notices` as Href)}
              />
            ) : null}
            <Row
              title={t.activity}
              hint={`${statusText}. ${t.declared}`}
              onPress={() => router.push(`/c/${id}/activity` as Href)}
            />
            <Row
              title={t.profile}
              hint={t.profileHint}
              onPress={() => router.navigate(`/c/${id}/profile` as Href)}
            />
          </>
        ) : null}
      </QueryGate>
    </Screen>
  );
}
