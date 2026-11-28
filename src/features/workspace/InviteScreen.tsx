import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { useWorkspaceId } from "./useWorkspaceId";
import { ApiError } from "@/lib/api/client";
import { useRefreshWorkspace, useRoles, useWsContext, wsApi } from "@/lib/api/workspaces";
import { mapFieldErrors, problemMessage } from "@/lib/problems";
import { isEmail } from "@/lib/validation";
import { PERM, assignableRoles, can, leastPrivilegedRole, splitEmails } from "@/lib/workspace";
import { strings } from "@/strings";
import { Button } from "@/ui/Button";
import { Chips } from "@/ui/Chips";
import { Notice } from "@/ui/Notice";
import { QueryGate } from "@/ui/QueryGate";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { TextField } from "@/ui/TextField";

const t = strings.ws.invite;

/** Invite form: role picker offers only roles the caller may give (AC11). */
export function InviteScreen() {
  const id = useWorkspaceId();
  const router = useRouter();
  const ctx = useWsContext(id);
  const roles = useRoles(id);
  const refresh = useRefreshWorkspace(id);
  const [emails, setEmails] = useState("");
  const [roleId, setRoleId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [failures, setFailures] = useState<string[]>([]);
  const [sent, setSent] = useState(0);
  const [busy, setBusy] = useState(false);

  const perms = ctx.data?.permissions ?? [];
  const options = assignableRoles(roles.data ?? [], perms);
  const effectiveRoleId = roleId ?? (leastPrivilegedRole(options) ?? options[0])?.id ?? null;

  const submit = async () => {
    setError(null);
    setFieldError(undefined);
    setFailures([]);
    setSent(0);
    const list = splitEmails(emails);
    if (list.length === 0) return setFieldError("Enter your colleague's email address.");
    const bad = list.find((e) => !isEmail(e));
    if (bad) return setFieldError(`"${bad}" isn't a valid email address.`);
    if (!effectiveRoleId) return setError(t.noRoles);
    setBusy(true);
    let ok = 0;
    const failed: string[] = [];
    for (const email of list) {
      try {
        await wsApi.invite(id, email, effectiveRoleId);
        ok += 1;
      } catch (e) {
        if (e instanceof ApiError) {
          const f = mapFieldErrors(e.problem.errors);
          failed.push(`${email}: ${f.email ?? problemMessage(e.problem, "invite")}`);
          if (e.slug === "too-many-attempts") break;
        } else
          failed.push(`${email}: ${problemMessage({ type: "/problems/unavailable", status: 0 })}`);
      }
    }
    setBusy(false);
    setSent(ok);
    setFailures(failed);
    if (ok > 0) await refresh();
    if (failed.length === 0) router.back();
  };

  return (
    <Screen edges={["bottom"]}>
      <Stack.Screen options={{ title: t.title }} />
      <QueryGate queries={[ctx, roles]}>
        {!can(perms, PERM.membersInvite) ? (
          <Notice>{problemMessage({ type: "/problems/forbidden", status: 403 })}</Notice>
        ) : (
          <>
            <Notice>{t.note}</Notice>
            <TextField
              label={t.email}
              hint={t.emailHint}
              value={emails}
              onChangeText={setEmails}
              error={fieldError}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              multiline
            />
            {options.length === 0 ? (
              <Notice tone="warning">{t.noRoles}</Notice>
            ) : (
              <>
                <Text variant="footnote" tone="text2" bold>
                  {t.role}
                </Text>
                <Chips
                  label={t.role}
                  value={effectiveRoleId ?? ""}
                  onChange={setRoleId}
                  options={options.map((r) => ({ value: r.id, label: r.name }))}
                />
                <Text variant="footnote" tone="textMuted">
                  {t.roleHint}
                </Text>
              </>
            )}
            {error ? <Notice tone="danger">{error}</Notice> : null}
            {sent > 0 ? <Notice tone="success">{t.sent(sent)}</Notice> : null}
            {failures.length > 0 ? (
              <Notice tone="danger" title={t.someFailed(failures.length)}>
                {failures.join("\n")}
              </Notice>
            ) : null}
            <Button
              label={t.send}
              busy={busy}
              disabled={options.length === 0}
              onPress={() => void submit()}
            />
          </>
        )}
      </QueryGate>
    </Screen>
  );
}
