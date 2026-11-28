import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { acceptConsents, consentDocuments } from "@/lib/api/auth";
import { useAction } from "@/lib/useAction";
import { strings } from "@/strings";
import { Button } from "@/ui/Button";
import { Checkbox } from "@/ui/Checkbox";
import { Notice } from "@/ui/Notice";
import { Row } from "@/ui/Row";
import { Text } from "@/ui/Text";
import { openLegal } from "./webLinks";

/** Re-acceptance of newer terms (spec 0012 M3, AC4): nothing else is reachable but sign-out. */
export function ConsentGate({ onAccepted }: { onAccepted: () => void }) {
  const docs = useQuery({ queryKey: ["public", "consent-documents"], queryFn: consentDocuments });
  const [checked, setChecked] = useState(false);
  const [tried, setTried] = useState(false);
  const action = useAction(acceptConsents, "consent");
  const list = docs.data ?? [];

  const submit = async () => {
    if (!checked) {
      setTried(true);
      return;
    }
    const res = await action.exec(list.map((d) => d.id));
    if (res.ok) onAccepted();
  };

  return (
    <>
      <Text variant="title1" bold accessibilityRole="header">
        {strings.consent.title}
      </Text>
      <Text tone="text2">{strings.consent.intro}</Text>
      {docs.isError ? <Notice tone="warning">{strings.consent.unavailable}</Notice> : null}
      {list.map((d) => (
        <Row
          key={d.id}
          title={strings.consent.readDoc(strings.consent.kinds[d.kind] ?? d.kind)}
          hint={strings.consent.opensBrowser}
          onPress={() => openLegal(d.url)}
        />
      ))}
      {action.error ? <Notice tone="danger">{action.error}</Notice> : null}
      <Checkbox checked={checked} onChange={setChecked} label={strings.consent.checkbox}>
        <Text>{strings.consent.checkbox}</Text>
      </Checkbox>
      {tried && !checked ? (
        <Notice tone="warning">Accept the Terms of Service and Privacy Policy to continue.</Notice>
      ) : null}
      <Button
        label={action.pending ? strings.consent.accepting : strings.consent.accept}
        busy={action.pending}
        disabled={list.length === 0}
        onPress={() => void submit()}
      />
    </>
  );
}
