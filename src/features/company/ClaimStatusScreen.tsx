import { Stack, useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { EvidenceEditor } from "./EvidenceEditor";
import {
  companyApi,
  useEvidenceTypes,
  useMyClaim,
  useRefreshMyCompanies,
} from "@/lib/api/companies";
import { newKey, uploadPages } from "@/lib/api/claimFlow";
import {
  capacityLabel,
  claimStatusMeta,
  claimTimeline,
  evidenceBodies,
  formatBytes,
  isOpenClaim,
  type Claim,
  type EvidencePage,
} from "@/lib/company";
import { deletePageFile } from "@/lib/companyDrafts";
import { useAction } from "@/lib/useAction";
import { formatDate } from "@/lib/workspace";
import { strings } from "@/strings";
import { useTheme } from "@/theme/ThemeProvider";
import { space } from "@/theme/tokens";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { confirm } from "@/ui/confirm";
import { IndependenceNotice } from "@/ui/IndependenceNotice";
import { Notice } from "@/ui/Notice";
import { PrivacyScreen } from "@/ui/PrivacyScreen";
import { QueryGate } from "@/ui/QueryGate";
import { Screen } from "@/ui/Screen";
import { TextField } from "@/ui/TextField";
import { Text } from "@/ui/Text";

const t = strings.co.status;
const tc = strings.co.claim;

/** Claim status tracker: status, reviewer message, add evidence, withdraw (M18). */
export function ClaimStatusScreen() {
  const { claimId } = useLocalSearchParams<{ claimId: string }>();
  const claim = useMyClaim(claimId ?? "");
  return (
    <PrivacyScreen>
      <Screen edges={["bottom"]}>
        <Stack.Screen options={{ title: t.title }} />
        <QueryGate queries={[claim]}>
          {claim.data ? <ClaimBody claim={claim.data} /> : null}
        </QueryGate>
        <IndependenceNotice />
      </Screen>
    </PrivacyScreen>
  );
}

function ClaimBody({ claim }: { claim: Claim }) {
  const { c } = useTheme();
  const router = useRouter();
  const refresh = useRefreshMyCompanies();
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const meta = claimStatusMeta(claim.status);
  const steps = claimTimeline(claim.status);
  const summary = (t.summary as Record<string, string>)[claim.status] ?? "";

  const withdraw = useAction(async () => {
    await companyApi.withdraw(claim.id);
    await refresh();
  }, "claim");

  const onWithdraw = async () => {
    if (!(await confirm(t.withdraw, t.confirmWithdraw, t.withdraw))) return;
    setNotice(null);
    const res = await withdraw.exec();
    if (res.ok) setNotice(t.withdrawn);
  };

  const due = claim.status === "needs_information" && claim.response_due_at;
  return (
    <>
      <Text variant="title2" bold accessibilityRole="header">
        {claim.company.legal_name}
      </Text>
      <Badge label={meta.label} tone={meta.tone} />
      <Text tone="text2">{summary}</Text>
      {claim.status === "rejected" && claim.closed_reason === "no_response" ? (
        <Text variant="footnote" tone="textMuted">
          {t.noResponse}
        </Text>
      ) : null}
      {claim.status === "approved" && claim.approved_role ? (
        <Notice tone="success">{t.approvedAs(claim.approved_role.name)}</Notice>
      ) : null}
      <View accessibilityRole="list" style={{ gap: space[2] }}>
        <Text variant="footnote" tone="textMuted" bold accessibilityRole="header">
          {t.timeline}
        </Text>
        {steps.map((s) => (
          <Text
            key={s.key}
            accessibilityRole="text"
            style={{ color: s.state === "attention" ? c.warningFg : c.text }}
            bold={s.state === "current" || s.state === "attention"}
          >
            {`${s.label}: ${s.state === "done" ? "done" : s.state === "todo" ? "waiting" : s.state === "attention" ? "needs you" : "in progress"}`}
          </Text>
        ))}
      </View>
      {claim.message_from_reviewer ? (
        <Notice tone="warning" title={t.reviewerMessage}>
          {claim.message_from_reviewer}
        </Notice>
      ) : null}
      {due ? (
        <Text variant="footnote" tone="textMuted">
          {t.dueBy(formatDate(due))}
        </Text>
      ) : null}
      <Text variant="footnote" tone="textMuted">
        {t.capacity(capacityLabel(claim.capacity, claim.capacity_other))} ·{" "}
        {strings.co.mine.claimedOn(formatDate(claim.submitted_at))}
      </Text>

      <Text variant="footnote" tone="textMuted" bold accessibilityRole="header">
        {t.evidence}
      </Text>
      {claim.evidence.length === 0 ? <Text tone="textMuted">{t.noEvidence}</Text> : null}
      {claim.evidence.map((e) => (
        <Card key={e.id}>
          <Text bold>{e.type.label}</Text>
          <Text variant="footnote" tone="text2">
            {e.description}
          </Text>
          {e.file ? (
            <Text variant="footnote" tone="textMuted">
              {t.file(e.file.filename ?? "File", formatBytes(e.file.size_bytes))}
            </Text>
          ) : null}
          {e.reference ? (
            <Text variant="footnote" tone="textMuted">
              {t.reference(e.reference)}
            </Text>
          ) : null}
        </Card>
      ))}

      {notice ? <Notice tone="success">{notice}</Notice> : null}
      {withdraw.error ? <Notice tone="danger">{withdraw.error}</Notice> : null}

      {claim.can_add_evidence && !adding ? (
        <Button label={t.addEvidence} onPress={() => setAdding(true)} />
      ) : null}
      {adding ? (
        <AddEvidence
          claim={claim}
          onDone={(sent) => {
            setAdding(false);
            if (sent) setNotice(t.evidenceSent);
          }}
        />
      ) : null}
      {claim.status === "approved" ? (
        <Button
          label={t.openCompany}
          onPress={() => router.replace(`/c/${claim.company.id}` as Href)}
        />
      ) : null}
      {claim.can_withdraw && isOpenClaim(claim.status) && !adding ? (
        <Button
          label={t.withdraw}
          variant="secondary"
          destructive
          busy={withdraw.pending}
          onPress={() => void onWithdraw()}
        />
      ) : null}
    </>
  );
}

function AddEvidence({ claim, onDone }: { claim: Claim; onDone: (sent: boolean) => void }) {
  const types = useEvidenceTypes();
  const refresh = useRefreshMyCompanies();
  const [typeKey, setTypeKey] = useState("");
  const [pages, setPages] = useState<EvidencePage[]>([]);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [shown, setShown] = useState(false);
  const uploads = useRef<Record<string, string>>({});
  const key = useRef("");
  // Page files are not drafts: whatever is still held when the screen goes away is deleted.
  const pagesRef = useRef<EvidencePage[]>([]);
  useEffect(() => {
    pagesRef.current = pages;
  });
  useEffect(
    () => () => {
      pagesRef.current.forEach(deletePageFile);
    },
    [],
  );

  const type = types.data?.find((x) => x.key === typeKey);
  const none = !type || (pages.length === 0 && !reference.trim());
  const missingFile = !!type?.requires_file && pages.length === 0;

  const send = useAction(async () => {
    const ids = await uploadPages(
      pages,
      uploads.current,
      () => undefined,
      (p, u) => (uploads.current[p] = u),
    );
    key.current ||= newKey();
    await companyApi.addEvidence(
      claim.id,
      evidenceBodies(typeKey, type?.label ?? "", ids, reference),
      note.trim() || null,
      key.current,
    );
    await refresh();
  }, "claim");

  const edit =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      key.current = "";
      set(v);
    };

  const submit = async () => {
    setShown(true);
    if (none || missingFile) return;
    const res = await send.exec();
    if (res.ok) {
      pages.forEach(deletePageFile);
      onDone(true);
    }
  };

  const cancel = () => {
    pages.forEach(deletePageFile);
    onDone(false);
  };

  return (
    <>
      <Text variant="title2" bold accessibilityRole="header">
        {t.addEvidence}
      </Text>
      <Text tone="text2">{t.addEvidenceBody}</Text>
      <QueryGate queries={[types]}>
        <EvidenceEditor
          types={types.data ?? []}
          typeKey={typeKey}
          onTypeKey={edit(setTypeKey)}
          pages={pages}
          onPages={edit(setPages)}
          reference={reference}
          onReference={edit(setReference)}
        />
      </QueryGate>
      <TextField
        label={t.addNote}
        value={note}
        onChangeText={edit(setNote)}
        multiline
        maxLength={2000}
      />
      {shown && !type ? <Notice tone="danger">{tc.needsType}</Notice> : null}
      {shown && type && none ? <Notice tone="danger">{tc.needsEvidence}</Notice> : null}
      {shown && missingFile ? <Notice tone="danger">{tc.needsFile}</Notice> : null}
      {send.error ? <Notice tone="danger">{send.error}</Notice> : null}
      <Button label={t.sendEvidence} busy={send.pending} onPress={() => void submit()} />
      <Button
        label={strings.common.cancel}
        variant="link"
        disabled={send.pending}
        onPress={cancel}
      />
    </>
  );
}
