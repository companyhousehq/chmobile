import { Stack, useRouter, type Href } from "expo-router";
import { useMemo, useState } from "react";
import { AnswersView } from "./AnswersView";
import { QuestionField } from "./QuestionField";
import { useCompanyId } from "./useCompanyId";
import { companyApi, useActivity, useCompanyContext, useRefreshCompany } from "@/lib/api/companies";
import { useMe } from "@/lib/api/queries";
import {
  CPERM,
  answerErrorText,
  clampStep,
  sameAnswers,
  startingAnswers,
  type ActivityView,
} from "@/lib/company";
import { clearActivityDraft, loadActivityDraft, saveActivityDraft } from "@/lib/companyDrafts";
import { evaluate, pruneAnswers, visibleSections, type Answers } from "@/lib/questionnaire";
import { useAction } from "@/lib/useAction";
import { can, formatDate } from "@/lib/workspace";
import { strings } from "@/strings";
import { Button } from "@/ui/Button";
import { confirm } from "@/ui/confirm";
import { Notice } from "@/ui/Notice";
import { ProgressBar } from "@/ui/ProgressBar";
import { QueryGate } from "@/ui/QueryGate";
import { Row } from "@/ui/Row";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";

const t = strings.co.activity;

/**
 * Business activity questionnaire (M22): one question group per screen, a
 * server draft per step, a device draft when the save can't reach the server.
 * Answers are "declared by your company"; nothing here says an obligation
 * applies or a licence is valid.
 */
export function ActivityScreen() {
  const id = useCompanyId();
  const me = useMe();
  const ctx = useCompanyContext(id);
  const view = useActivity(id);
  const canEdit = can(ctx.data?.permissions, CPERM.activityUpdate);
  const refresh = useRefreshCompany(id);
  const source: ActivitySource = {
    draftKey: id,
    historyHref: `/c/${id}/activity/versions`,
    saveDraft: (body) => companyApi.saveDraft(id, body),
    complete: (rev) => companyApi.complete(id, rev),
    refresh,
  };
  return (
    <Screen edges={["bottom"]}>
      <Stack.Screen options={{ title: t.title }} />
      <QueryGate queries={[me, ctx, view]}>
        {view.data && me.data ? (
          <ActivityBody source={source} userId={me.data.id} view={view.data} canEdit={canEdit} />
        ) : null}
      </QueryGate>
    </Screen>
  );
}

/**
 * Where a questionnaire reads and writes: the company's own endpoints, or an
 * agent workspace's client endpoints (spec 0004). Device drafts are keyed by `draftKey`.
 */
export interface ActivitySource {
  draftKey: string;
  historyHref: string | null;
  saveDraft: (body: {
    questionnaire_version_id: string;
    expected_revision: number;
    answers: Answers;
  }) => Promise<ActivityView>;
  complete: (expectedRevision: number) => Promise<unknown>;
  refresh: () => Promise<unknown>;
}

export function ActivityBody({
  source,
  userId,
  view,
  canEdit,
}: {
  source: ActivitySource;
  userId: string;
  view: ActivityView;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [done, setDone] = useState(false);
  const def = view.questionnaire.definition;
  if (editing && canEdit) {
    return (
      <Wizard
        source={source}
        userId={userId}
        view={view}
        onExit={(completed) => {
          setEditing(false);
          setDone(completed);
        }}
      />
    );
  }
  const shown = view.current?.answers ?? {};
  const action = view.status === "complete" ? t.edit : view.status === "draft" ? t.resume : t.start;
  return (
    <>
      <Text variant="title2" bold accessibilityRole="header">
        {t.title}
      </Text>
      <Notice title={t.declared}>{t.declaredNote}</Notice>
      {done ? <Notice tone="success">{t.completed}</Notice> : null}
      {!canEdit ? <Notice>{t.readOnly}</Notice> : null}
      {view.newer_questionnaire_available ? <Notice tone="warning">{t.newer}</Notice> : null}
      {view.current ? (
        <Text variant="footnote" tone="textMuted">
          {t.versionBy(
            view.current.completed_by?.full_name ?? "",
            formatDate(view.current.completed_at),
          )}
        </Text>
      ) : (
        <Text tone="textMuted">{t.notStarted}</Text>
      )}
      {canEdit ? <Button label={action} onPress={() => setEditing(true)} /> : null}
      {view.current ? <AnswersView definition={def} answers={shown} /> : null}
      {source.historyHref ? (
        <Row
          title={t.history}
          hint={t.historyHint}
          onPress={() => router.push(source.historyHref as Href)}
        />
      ) : null}
    </>
  );
}

function Wizard({
  source,
  userId,
  view,
  onExit,
}: {
  source: ActivitySource;
  userId: string;
  view: ActivityView;
  onExit: (completed: boolean) => void;
}) {
  const def = view.questionnaire.definition;
  const qvId = view.draft?.questionnaire_version_id ?? view.questionnaire.id;
  const companyId = source.draftKey;
  const refresh = source.refresh;
  const device = useMemo(() => {
    const d = loadActivityDraft(userId, companyId);
    return d && d.questionnaireVersionId === qvId ? d : null;
  }, [userId, companyId, qvId]);
  const serverAnswers: Answers = view.draft?.answers ?? view.current?.answers ?? {};

  const [answers, setAnswers] = useState<Answers>(() =>
    startingAnswers(view, device?.answers ?? null),
  );
  const [saved, setSaved] = useState<Answers>(serverAnswers);
  const [revision, setRevision] = useState(view.draft?.revision ?? 0);
  const [restored, setRestored] = useState(
    !!device && !sameAnswers(def, device.answers, serverAnswers),
  );
  const [index, setIndex] = useState(() => {
    const i = device?.stepKey
      ? visibleSections(def, answers).findIndex((s) => s.section.key === device.stepKey)
      : 0;
    return Math.max(0, i);
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const steps = visibleSections(def, answers);
  const step = clampStep(index, steps.length + 1);
  const onReview = step >= steps.length;
  const current = steps[step];
  const dirty = !sameAnswers(def, answers, saved);

  const change = (key: string, value: unknown) => {
    const next = { ...answers };
    if (value === undefined) delete next[key];
    else next[key] = value;
    setAnswers(next);
    setErrors((e) => {
      const { [key]: _drop, ...rest } = e;
      return rest;
    });
    saveActivityDraft(userId, companyId, {
      answers: next,
      questionnaireVersionId: qvId,
      stepKey: current?.section.key ?? null,
    });
  };

  /** Saves the draft to the server and only then marks it saved. Returns the new revision. */
  const persist = async (): Promise<number> => {
    const body = pruneAnswers(def, answers);
    const v = await source.saveDraft({
      questionnaire_version_id: qvId,
      expected_revision: revision,
      answers: body,
    });
    const rev = v.draft?.revision ?? revision + 1;
    setRevision(rev);
    setSaved(body);
    setRestored(false);
    clearActivityDraft(userId, companyId);
    await refresh();
    return rev;
  };

  const save = useAction(persist, "company");
  const finish = useAction(async () => {
    const rev = dirty || revision === 0 ? await persist() : revision;
    await source.complete(rev);
    clearActivityDraft(userId, companyId);
    await refresh();
  }, "company");

  const stepErrors = (): Record<string, string> => {
    const out: Record<string, string> = {};
    const keys = new Set(current?.questions.map((q) => q.key) ?? []);
    for (const e of evaluate(def, answers).errors) {
      const key = e.field.replace(/^answers\./, "");
      const q = current?.questions.find((x) => x.key === key);
      if (q && keys.has(key)) out[key] = answerErrorText(q, e.code);
    }
    return out;
  };

  const next = async () => {
    const e = stepErrors();
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    const res = await save.exec();
    if (res.ok) setIndex(step + 1);
  };

  const back = () => {
    if (step === 0) onExit(false);
    else setIndex(step - 1);
  };

  const complete = async () => {
    const res = await finish.exec();
    if (res.ok) onExit(true);
  };

  const discardDevice = async () => {
    if (!(await confirm(t.discardDevice, t.deviceDraft, t.discardDevice))) return;
    clearActivityDraft(userId, companyId);
    setAnswers(serverAnswers);
    setRestored(false);
  };

  const offline = (a: { slug: string | null }) => a.slug === "unavailable";
  const failed = save.error ? save : finish.error ? finish : null;
  const missing = evaluate(def, answers);
  const labelOf = (key: string) =>
    def.sections.flatMap((s) => s.questions).find((q) => q.key === key)?.label ?? key;

  return (
    <>
      <ProgressBar
        value={(step + 1) / (steps.length + 1)}
        label={t.progress(step + 1, steps.length + 1)}
      />
      <Text variant="footnote" tone="textMuted">
        {t.progress(step + 1, steps.length + 1)} · {dirty ? t.unsaved : t.saved}
      </Text>
      <Notice title={t.declared}>{t.declaredNote}</Notice>
      {restored && dirty ? (
        <>
          <Notice tone="warning">{t.deviceDraft}</Notice>
          <Button
            label={t.discardDevice}
            variant="link"
            destructive
            onPress={() => void discardDevice()}
          />
        </>
      ) : null}

      {!onReview && current ? (
        <>
          <Text variant="title2" bold accessibilityRole="header">
            {current.section.title}
          </Text>
          {current.section.description ? (
            <Text tone="text2">{current.section.description}</Text>
          ) : null}
          {current.questions.map((q) => (
            <QuestionField
              key={q.key}
              q={q}
              value={answers[q.key]}
              onChange={(v) => change(q.key, v)}
              error={errors[q.key]}
            />
          ))}
        </>
      ) : (
        <>
          <Text variant="title2" bold accessibilityRole="header">
            {t.review}
          </Text>
          <AnswersView definition={def} answers={answers} />
          {missing.missing.length > 0 ? (
            <Notice tone="warning" title={t.stillMissing}>
              {missing.missing.map(labelOf).join("\n")}
            </Notice>
          ) : null}
        </>
      )}

      {failed ? (
        offline(failed) ? (
          <Notice tone="warning">{t.offline}</Notice>
        ) : (
          <Notice tone="danger">{failed.error ?? ""}</Notice>
        )
      ) : null}
      {failed && ["draft-conflict", "questionnaire-outdated"].includes(failed.slug ?? "") ? (
        <Button
          label={t.reload}
          variant="secondary"
          onPress={() => {
            void refresh();
            onExit(false);
          }}
        />
      ) : null}

      {onReview ? (
        <Button
          label={t.complete}
          busy={finish.pending}
          disabled={missing.missing.length > 0 || missing.errors.length > 0}
          onPress={() => void complete()}
        />
      ) : (
        <Button label={t.next} busy={save.pending} onPress={() => void next()} />
      )}
      <Button
        label={t.back}
        variant="link"
        disabled={save.pending || finish.pending}
        onPress={back}
      />
    </>
  );
}
