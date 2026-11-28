import { Stack } from "expo-router";
import { useState } from "react";
import { useCompanyId } from "./useCompanyId";
import {
  companyApi,
  useClaimNotices,
  useCompanyContext,
  useRefreshCompany,
} from "@/lib/api/companies";
import { CPERM, capacityLabel, type ClaimNotice } from "@/lib/company";
import { useAction } from "@/lib/useAction";
import { can, formatDate } from "@/lib/workspace";
import { strings } from "@/strings";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { IndependenceNotice } from "@/ui/IndependenceNotice";
import { Notice } from "@/ui/Notice";
import { QueryGate } from "@/ui/QueryGate";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { TextField } from "@/ui/TextField";

const t = strings.co.notices;

/** Contested-claim notices for Owners: claimant name and capacity only, with a reply (M19). */
export function ClaimNoticesScreen() {
  const id = useCompanyId();
  const ctx = useCompanyContext(id);
  const isOwner = can(ctx.data?.permissions, CPERM.ownersManage);
  const list = useClaimNotices(id, ctx.isSuccess && isOwner);
  return (
    <Screen edges={["bottom"]}>
      <Stack.Screen options={{ title: t.title }} />
      <QueryGate queries={[ctx, ...(isOwner ? [list] : [])]}>
        {!isOwner ? (
          <Notice>{t.onlyOwners}</Notice>
        ) : (
          <>
            <Text tone="text2">{t.intro}</Text>
            {(list.data ?? []).length === 0 ? <Text tone="textMuted">{t.empty}</Text> : null}
            {(list.data ?? []).map((n) => (
              <NoticeCard key={n.claim_id} companyId={id} notice={n} />
            ))}
          </>
        )}
        <IndependenceNotice />
      </QueryGate>
    </Screen>
  );
}

function NoticeCard({ companyId, notice }: { companyId: string; notice: ClaimNotice }) {
  const refresh = useRefreshCompany(companyId);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);
  const [needNote, setNeedNote] = useState(false);
  const reply = useAction(async (stance: "object" | "support") => {
    await companyApi.respondToNotice(companyId, notice.claim_id, stance, note);
    await refresh();
  }, "company");

  const send = async (stance: "object" | "support") => {
    setSent(false);
    setNeedNote(false);
    if (stance === "object" && !note.trim()) return setNeedNote(true);
    const res = await reply.exec(stance);
    if (res.ok) setSent(true);
  };

  return (
    <Card>
      <Text bold>{notice.claimant.full_name}</Text>
      <Text variant="footnote" tone="text2">
        {t.capacity(capacityLabel(notice.capacity, notice.capacity_other))}
      </Text>
      <Text variant="footnote" tone="textMuted">
        {t.submitted(formatDate(notice.submitted_at))}
      </Text>
      {notice.my_response ? (
        <Text variant="footnote" tone="text2">
          {t.yours(notice.my_response.stance === "object" ? t.stanceObject : t.stanceSupport)}
        </Text>
      ) : (
        <>
          <TextField
            label={t.note}
            value={note}
            onChangeText={setNote}
            multiline
            maxLength={2000}
            error={needNote ? t.noteRequired : reply.fields.note}
          />
          {reply.error ? <Notice tone="danger">{reply.error}</Notice> : null}
          {sent ? <Notice tone="success">{t.sent}</Notice> : null}
          <Button
            label={t.confirm}
            variant="secondary"
            busy={reply.pending}
            onPress={() => void send("support")}
          />
          <Button
            label={t.object}
            destructive
            busy={reply.pending}
            onPress={() => void send("object")}
          />
        </>
      )}
    </Card>
  );
}
