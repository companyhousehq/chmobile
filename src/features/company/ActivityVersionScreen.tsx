import { Stack, useLocalSearchParams } from "expo-router";
import { AnswersView } from "./AnswersView";
import { useCompanyId } from "./useCompanyId";
import { useActivityVersion } from "@/lib/api/companies";
import type { ActivityVersionDetail } from "@/lib/company";
import type { UseQueryResult } from "@tanstack/react-query";
import { formatDate } from "@/lib/workspace";
import { strings } from "@/strings";
import { Notice } from "@/ui/Notice";
import { QueryGate } from "@/ui/QueryGate";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";

const t = strings.co.activity;

/** One past version, read-only, answers labelled as declared by the company. */
export function ActivityVersionScreen() {
  const id = useCompanyId();
  const { version } = useLocalSearchParams<{ version: string }>();
  const n = Number(version);
  const q = useActivityVersion(id, n);
  return <VersionDetail n={n} q={q} />;
}

/** One version, for a company's own history and for a client's (agent side). */
export function VersionDetail({ n, q }: { n: number; q: UseQueryResult<ActivityVersionDetail> }) {
  return (
    <Screen edges={["bottom"]}>
      <Stack.Screen options={{ title: t.versionTitle(n) }} />
      <QueryGate queries={[q]}>
        {q.data ? (
          <>
            <Notice title={t.declared}>{t.declaredNote}</Notice>
            <Text variant="footnote" tone="textMuted">
              {t.versionBy(q.data.completed_by?.full_name ?? "", formatDate(q.data.completed_at))}
            </Text>
            {q.data.acting_workspace ? (
              <Text variant="footnote" tone="textMuted">
                {t.actingFor(q.data.acting_workspace.display_name)}
              </Text>
            ) : null}
            <AnswersView definition={q.data.questionnaire.definition} answers={q.data.answers} />
          </>
        ) : null}
      </QueryGate>
    </Screen>
  );
}
