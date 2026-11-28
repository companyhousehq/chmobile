import { useQueryClient } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";
import { useSession } from "@/auth/SessionProvider";
import { revokeOtherSessions, revokeSession } from "@/lib/api/auth";
import { keys, useMe, useSessions } from "@/lib/api/queries";
import { formatWhen, clientLabel, sortSessions } from "@/lib/sessions";
import { useAction } from "@/lib/useAction";
import { strings } from "@/strings";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, space } from "@/theme/tokens";
import { Button } from "@/ui/Button";
import { Notice } from "@/ui/Notice";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";

/** Sessions (spec 0012 M5, AC6): list, revoke one, revoke all others; revoking this device signs out. */
export default function Sessions() {
  const { c } = useTheme();
  const qc = useQueryClient();
  const { wipe } = useSession();
  const me = useMe();
  const sessions = useSessions(me.data?.id);
  const [message, setMessage] = useState<string | null>(null);
  const revoke = useAction(revokeSession);
  const revokeOthers = useAction(revokeOtherSessions);

  const refresh = () => qc.invalidateQueries({ queryKey: keys.sessions(me.data?.id ?? "") });

  const confirm = (title: string, body: string, ok: () => void) =>
    Alert.alert(title, body, [
      { text: strings.common.cancel, style: "cancel" },
      { text: title, style: "destructive", onPress: ok },
    ]);

  const onRevoke = (id: string, current: boolean) =>
    confirm(
      strings.sessions.revokeConfirmTitle,
      current ? strings.sessions.revokeThisBody : strings.sessions.revokeConfirmBody,
      async () => {
        setMessage(null);
        const res = await revoke.exec(id);
        if (!res.ok) return;
        if (current) await wipe();
        else void refresh();
      },
    );

  const onRevokeOthers = () =>
    confirm(strings.sessions.revokeOthersTitle, strings.sessions.revokeOthersBody, async () => {
      const res = await revokeOthers.exec();
      if (res.ok) {
        setMessage(strings.sessions.othersDone(res.value.revoked));
        void refresh();
      }
    });

  const items = sortSessions(sessions.data ?? []);
  const others = items.filter((s) => !s.current).length;

  return (
    <Screen edges={["bottom"]}>
      <Stack.Screen options={{ title: strings.sessions.title }} />
      <Text tone="text2">{strings.sessions.intro}</Text>
      {sessions.isError ? <Notice tone="danger">{strings.common.offline}</Notice> : null}
      {(revoke.error ?? revokeOthers.error) ? (
        <Notice tone="danger">{revoke.error ?? revokeOthers.error ?? ""}</Notice>
      ) : null}
      {message ? <Notice tone="success">{message}</Notice> : null}
      {items.map((s) => (
        <View
          key={s.id}
          accessible
          accessibilityLabel={`${clientLabel(s)}${s.current ? `, ${strings.sessions.thisDevice}` : ""}. ${strings.sessions.lastActive} ${formatWhen(s.last_seen_at)}`}
          style={{
            gap: space[1],
            padding: space[3],
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: s.current ? c.accent : c.border,
            backgroundColor: c.surface,
          }}
        >
          <Text bold>{clientLabel(s)}</Text>
          {s.current ? (
            <Text variant="footnote" tone="accent" bold>
              {strings.sessions.thisDevice}
            </Text>
          ) : null}
          <Text variant="footnote" tone="textMuted">
            {strings.sessions.lastActive}: {formatWhen(s.last_seen_at)}
          </Text>
          <Text variant="footnote" tone="textMuted">
            {strings.sessions.created}: {formatWhen(s.created_at)}
            {s.ip_approx ? ` · ${s.ip_approx}` : ""}
          </Text>
          <Button
            label={strings.sessions.revoke}
            variant="link"
            destructive
            onPress={() => onRevoke(s.id, s.current)}
          />
        </View>
      ))}
      {others > 0 ? (
        <Button
          label={strings.sessions.revokeOthers}
          variant="secondary"
          destructive
          busy={revokeOthers.pending}
          onPress={onRevokeOthers}
        />
      ) : sessions.isSuccess ? (
        <Text variant="footnote" tone="textMuted">
          {strings.sessions.empty}
        </Text>
      ) : null}
    </Screen>
  );
}
