import { Stack, useRouter, type Href } from "expo-router";
import { useCompanyId } from "./useCompanyId";
import { useActivityVersions } from "@/lib/api/companies";
import type { ActivityVersionItem } from "@/lib/company";
import type { UseQueryResult } from "@tanstack/react-query";
import { formatDate } from "@/lib/workspace";
import { strings } from "@/strings";
import { Badge } from "@/ui/Badge";
import { QueryGate } from "@/ui/QueryGate";
import { Row } from "@/ui/Row";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";

const t = strings.co.activity;

/** Version history: who completed each version and when; each opens read-only. */
export function ActivityVersionsScreen() {
  const id = useCompanyId();
  const list = useActivityVersions(id);
  return <VersionsList list={list} hrefFor={(n) => `/c/${id}/activity/versions/${n}`} />;
}

/** The list itself, for a company's own history and for a client's (agent side). */
export function VersionsList({
  list,
  hrefFor,
}: {
  list: UseQueryResult<ActivityVersionItem[]>;
  hrefFor: (version: number) => string;
}) {
  const router = useRouter();
  const items = [...(list.data ?? [])].sort((a, b) => b.version - a.version);
  return (
    <Screen edges={["bottom"]}>
      <Stack.Screen options={{ title: t.history }} />
      <QueryGate queries={[list]}>
        {items.length === 0 ? <Text tone="textMuted">{t.noVersions}</Text> : null}
        {items.map((v, i) => (
          <Row
            key={v.version}
            title={t.versionTitle(v.version)}
            hint={t.versionBy(v.completed_by?.full_name ?? "", formatDate(v.completed_at))}
            right={i === 0 ? <Badge label={t.versionCurrent} tone="success" /> : undefined}
            onPress={() => router.push(hrefFor(v.version) as Href)}
          />
        ))}
      </QueryGate>
    </Screen>
  );
}
