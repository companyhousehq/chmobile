import { memberStatusLabel, formatDate, type TeamRow } from "@/lib/workspace";
import { strings } from "@/strings";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Text } from "@/ui/Text";

const t = strings.ws.team;

/** A member or invited row as a card with an Actions button (spec 0012 OQ-8). */
export function TeamCard({
  row,
  own,
  hasActions,
  onActions,
}: {
  row: TeamRow;
  own: boolean;
  hasActions: boolean;
  onActions: () => void;
}) {
  const tone =
    row.status === "active" ? "success" : row.status === "suspended" ? "danger" : "warning";
  const inv = row.invitation;
  const when = inv
    ? row.status === "expired"
      ? t.expiredOn(formatDate(inv.expires_at))
      : t.expires(formatDate(inv.expires_at))
    : null;
  return (
    <Card>
      <Text bold>
        {row.title}
        {own ? ` (${t.you})` : ""}
      </Text>
      <Text variant="footnote" tone="text2">
        {row.role}
      </Text>
      {row.kind === "member" && row.email ? (
        <Text variant="footnote" tone="textMuted">
          {[row.email, row.phone].filter(Boolean).join(" · ")}
        </Text>
      ) : null}
      {when ? (
        <Text variant="footnote" tone="textMuted">
          {when}
        </Text>
      ) : null}
      <Badge label={memberStatusLabel(row.status)} tone={tone} />
      {hasActions ? (
        <Button label={`${t.actions}: ${row.title}`} variant="secondary" onPress={onActions} />
      ) : null}
    </Card>
  );
}
