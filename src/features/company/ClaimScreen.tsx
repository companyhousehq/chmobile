import { Stack, useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useRef, useState } from "react";
import { EvidenceEditor } from "./EvidenceEditor";
import { companyApi, useEvidenceTypes, useRefreshMyCompanies } from "@/lib/api/companies";
import { newKey, renewUploads, uploadPages, withUploadRenewal } from "@/lib/api/claimFlow";
import { useMe } from "@/lib/api/queries";
import {
  CAPACITIES,
  capacityLabel,
  claimDraftProblems,
  evidenceBodies,
  type ClaimDraft,
} from "@/lib/company";
import { clearClaimDraft, loadClaimDraft, saveClaimDraft } from "@/lib/companyDrafts";
import { useAction } from "@/lib/useAction";
import { strings } from "@/strings";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Chips } from "@/ui/Chips";
import { confirm } from "@/ui/confirm";
import { IndependenceNotice } from "@/ui/IndependenceNotice";
import { Notice } from "@/ui/Notice";
import { PrivacyScreen } from "@/ui/PrivacyScreen";
import { ProgressBar } from "@/ui/ProgressBar";
import { QueryGate } from "@/ui/QueryGate";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { TextField } from "@/ui/TextField";

const t = strings.co.claim;
const STEPS = 3;

/**
 * Claim a company: capacity, evidence (camera, photos, file or reference),
 * review (M17). The draft waits on the device until it is sent and is removed
 * on sign-out. The screen is hidden from the app switcher (AC29).
 */
export function ClaimScreen() {
  const { companyId, name } = useLocalSearchParams<{ companyId: string; name?: string }>();
  const me = useMe();
  const userId = me.data?.id;
  return (
    <PrivacyScreen>
      <Screen edges={["bottom"]}>
        <Stack.Screen options={{ title: t.title }} />
        <QueryGate queries={[me]}>
          {userId ? (
            <ClaimForm userId={userId} companyId={companyId ?? ""} name={name ?? ""} />
          ) : null}
        </QueryGate>
      </Screen>
    </PrivacyScreen>
  );
}

function ClaimForm({
  userId,
  companyId,
  name,
}: {
  userId: string;
  companyId: string;
  name: string;
}) {
  const router = useRouter();
  const types = useEvidenceTypes();
  const refresh = useRefreshMyCompanies();
  const [draft, setDraft] = useState<ClaimDraft>(() => loadClaimDraft(userId, companyId));
  const draftRef = useRef(draft);
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState<string | null>(null);
  const [shownProblems, setShownProblems] = useState<string[]>([]);

  const persist = (next: ClaimDraft) => {
    draftRef.current = next;
    setDraft(next);
    saveClaimDraft(userId, companyId, next);
  };
  /** Content edits drop the submission key: a changed body needs a new Idempotency-Key. */
  const edit = (patch: Partial<ClaimDraft>) =>
    persist({ ...draftRef.current, ...patch, submitKey: "" });

  const type = types.data?.find((x) => x.key === draft.typeKey);
  const problems = claimDraftProblems(draft, type);

  const attempt = async () => {
    const d = draftRef.current;
    const ids = await uploadPages(
      d.pages,
      d.uploads,
      (i, n) => setProgress(t.uploading(i, n)),
      (pageId, uploadId) =>
        persist({
          ...draftRef.current,
          uploads: { ...draftRef.current.uploads, [pageId]: uploadId },
        }),
    );
    setProgress(t.submitting);
    const key = draftRef.current.submitKey || newKey();
    if (!draftRef.current.submitKey) persist({ ...draftRef.current, submitKey: key });
    const label = type?.label ?? "";
    return companyApi.submitClaim(
      {
        company_id: companyId,
        capacity: d.capacity,
        capacity_other: d.capacity === "other" ? d.capacityOther.trim() : null,
        message: d.message.trim() || null,
        evidence: evidenceBodies(d.typeKey, label, ids, d.reference),
      },
      key,
    );
  };

  // An expired or unknown upload: forget the upload ids, give pages new ids, upload again, once.
  const submit = useAction(
    () => withUploadRenewal(attempt, () => persist(renewUploads(draftRef.current))),
    "claim",
  );

  const send = async () => {
    setShownProblems(problems);
    if (problems.length > 0) return;
    const res = await submit.exec();
    setProgress(null);
    if (!res.ok) return;
    clearClaimDraft(userId, companyId);
    await refresh();
    router.replace(`/companies/claims/${res.value.id}` as Href);
  };

  const discard = async () => {
    if (await confirm(t.discard, t.confirmDiscard, t.discard)) {
      clearClaimDraft(userId, companyId);
      router.back();
    }
  };

  const problemText: Record<string, string> = {
    type: t.needsType,
    capacity: t.needsCapacity,
    evidence: t.needsEvidence,
    file: t.needsFile,
    too_many: t.tooMany,
  };

  return (
    <>
      <ProgressBar value={(step + 1) / STEPS} label={t.step(step + 1, STEPS)} />
      <Text variant="footnote" tone="textMuted">
        {t.step(step + 1, STEPS)}
      </Text>
      <Text variant="title2" bold accessibilityRole="header">
        {step === 0 ? t.capacityTitle : step === 1 ? t.evidenceTitle : t.reviewTitle}
      </Text>
      {name ? <Text tone="text2">{t.forCompany(name)}</Text> : null}
      <IndependenceNotice />

      {step === 0 ? (
        <>
          <Chips
            label={t.capacity}
            value={draft.capacity}
            onChange={(v) => edit({ capacity: v })}
            options={CAPACITIES.map((c) => ({ value: c.value, label: c.label }))}
          />
          {draft.capacity === "other" ? (
            <TextField
              label={t.capacityOther}
              value={draft.capacityOther}
              onChangeText={(v) => edit({ capacityOther: v })}
              maxLength={200}
              error={shownProblems.includes("capacity") ? t.needsCapacity : undefined}
            />
          ) : null}
          <TextField
            label={t.message}
            value={draft.message}
            onChangeText={(v) => edit({ message: v })}
            multiline
            maxLength={2000}
          />
          <Notice>{t.draftKept}</Notice>
          <Button
            label={t.next}
            disabled={draft.capacity === "other" && !draft.capacityOther.trim()}
            onPress={() => setStep(1)}
          />
        </>
      ) : null}

      {step === 1 ? (
        <>
          <Text tone="text2">{t.evidenceBody}</Text>
          <QueryGate queries={[types]}>
            <EvidenceEditor
              types={types.data ?? []}
              typeKey={draft.typeKey}
              onTypeKey={(k) => edit({ typeKey: k })}
              pages={draft.pages}
              onPages={(p) => edit({ pages: p })}
              reference={draft.reference}
              onReference={(r) => edit({ reference: r })}
            />
          </QueryGate>
          <Button label={t.review} onPress={() => setStep(2)} />
          <Button label={strings.common.back} variant="link" onPress={() => setStep(0)} />
        </>
      ) : null}

      {step === 2 ? (
        <>
          <Card>
            <Text bold>{capacityLabel(draft.capacity, draft.capacityOther)}</Text>
            <Text variant="footnote" tone="text2">
              {type?.label ?? ""}
            </Text>
            <Text variant="footnote" tone="textMuted">
              {t.pages(draft.pages.length)}
              {draft.reference.trim() ? `, ${draft.reference.trim()}` : ""}
            </Text>
            {draft.message.trim() ? <Text variant="footnote">{draft.message.trim()}</Text> : null}
          </Card>
          {shownProblems.map((p) => (
            <Notice key={p} tone="danger">
              {problemText[p] ?? ""}
            </Notice>
          ))}
          {submit.error ? <Notice tone="danger">{submit.error}</Notice> : null}
          {progress ? <Notice>{progress}</Notice> : null}
          <Button label={t.submit} busy={submit.pending} onPress={() => void send()} />
          <Button
            label={strings.common.back}
            variant="link"
            disabled={submit.pending}
            onPress={() => setStep(1)}
          />
        </>
      ) : null}
      <Button
        label={t.discard}
        variant="link"
        destructive
        disabled={submit.pending}
        onPress={() => void discard()}
      />
    </>
  );
}
