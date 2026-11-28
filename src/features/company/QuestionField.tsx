import { useState } from "react";
import { View } from "react-native";
import { parseIntegerText } from "@/lib/company";
import { DEFAULT_PERSON_FIELDS, type PersonField, type Question } from "@/lib/questionnaire";
import { strings } from "@/strings";
import { space } from "@/theme/tokens";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Chips } from "@/ui/Chips";
import { MultiChips } from "@/ui/MultiChips";
import { Text } from "@/ui/Text";
import { TextField } from "@/ui/TextField";

const t = strings.co.activity;

type Row = Record<string, unknown>;

/** One input for a questionnaire question, by type (M22). `onChange(undefined)` clears the answer. */
export function QuestionField({
  q,
  value,
  onChange,
  error,
}: {
  q: Question;
  value: unknown;
  onChange: (v: unknown) => void;
  error?: string;
}) {
  const label = q.required ? q.label : `${q.label} (${strings.common.optional})`;
  switch (q.type) {
    case "text":
    case "long_text":
      return (
        <TextField
          label={label}
          hint={q.help}
          value={typeof value === "string" ? value : ""}
          onChangeText={(v) => onChange(v === "" ? undefined : v)}
          multiline={q.type === "long_text"}
          maxLength={q.max_length}
          error={error}
        />
      );
    case "integer":
      return <IntegerField q={q} label={label} value={value} onChange={onChange} error={error} />;
    case "date":
    case "month_day":
      return (
        <TextField
          label={label}
          hint={
            q.help ??
            (q.type === "date" ? "Year-month-day, like 2019-03-27." : "Month-day, like 03-27.")
          }
          value={typeof value === "string" ? value : ""}
          onChangeText={(v) => onChange(v === "" ? undefined : v)}
          keyboardType="numbers-and-punctuation"
          autoCorrect={false}
          error={error}
        />
      );
    case "boolean":
      return (
        <Group label={label} help={q.help} error={error}>
          <Chips
            label={q.label}
            value={value === true ? "yes" : value === false ? "no" : ""}
            onChange={(v) => onChange(v === "yes")}
            options={[
              { value: "yes", label: t.yes },
              { value: "no", label: t.no },
            ]}
          />
          {value !== undefined && value !== null ? (
            <Button
              label={`${t.clear}: ${q.label}`}
              variant="link"
              onPress={() => onChange(undefined)}
            />
          ) : null}
        </Group>
      );
    case "single_select":
      return (
        <Group label={label} help={q.help} error={error}>
          <Chips
            label={q.label}
            value={typeof value === "string" ? value : ""}
            onChange={onChange}
            options={q.options ?? []}
          />
        </Group>
      );
    case "multi_select":
      return (
        <Group label={label} help={q.help} error={error}>
          <MultiChips
            label={q.label}
            value={Array.isArray(value) ? (value as string[]) : []}
            onChange={(v) => onChange(v.length === 0 ? undefined : v)}
            options={q.options ?? []}
          />
        </Group>
      );
    case "person_list":
      return <PersonList q={q} label={label} value={value} onChange={onChange} error={error} />;
    default:
      return null;
  }
}

function Group({
  label,
  help,
  error,
  children,
}: {
  label: string;
  help?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: space[2] }}>
      <Text variant="footnote" tone="text2" bold>
        {label}
      </Text>
      {help ? (
        <Text variant="footnote" tone="textMuted">
          {help}
        </Text>
      ) : null}
      {children}
      {error ? (
        <Text variant="footnote" tone="dangerFg" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

function IntegerField({
  q,
  label,
  value,
  onChange,
  error,
}: {
  q: Question;
  label: string;
  value: unknown;
  onChange: (v: unknown) => void;
  error?: string;
}) {
  const [text, setText] = useState(typeof value === "number" ? String(value) : "");
  const bad = text.trim() !== "" && parseIntegerText(text) === null;
  return (
    <TextField
      label={label}
      hint={q.help}
      value={text}
      onChangeText={(v) => {
        setText(v);
        onChange(parseIntegerText(v) ?? undefined);
      }}
      keyboardType="number-pad"
      error={bad ? t.badInteger : error}
    />
  );
}

function PersonList({
  q,
  label,
  value,
  onChange,
  error,
}: {
  q: Question;
  label: string;
  value: unknown;
  onChange: (v: unknown) => void;
  error?: string;
}) {
  const rows: Row[] = Array.isArray(value) ? (value as Row[]) : [];
  const fields: readonly PersonField[] =
    q.fields && q.fields.length > 0 ? q.fields : DEFAULT_PERSON_FIELDS;
  const max = Math.min(q.max_items ?? 50, 50);
  const setRows = (next: Row[]) => onChange(next.length === 0 ? undefined : next);
  const setCell = (i: number, f: PersonField, raw: string) => {
    const row = { ...rows[i] };
    if (raw.trim() === "") delete row[f.key];
    else if ((f.type ?? "text") === "number") {
      const n = Number(raw.replace(",", "."));
      if (Number.isFinite(n)) row[f.key] = n;
    } else row[f.key] = raw;
    setRows(rows.map((r, j) => (j === i ? row : r)));
  };
  return (
    <Group label={label} help={q.help} error={error}>
      {rows.map((row, i) => (
        <Card key={i}>
          <Text bold>{t.personN(i + 1)}</Text>
          {fields.map((f) => (
            <TextField
              key={f.key}
              label={f.required ? f.label : `${f.label} (${strings.common.optional})`}
              value={row[f.key] === undefined || row[f.key] === null ? "" : String(row[f.key])}
              onChangeText={(v) => setCell(i, f, v)}
              keyboardType={(f.type ?? "text") === "number" ? "decimal-pad" : "default"}
              maxLength={200}
            />
          ))}
          <Button
            label={`${t.removePerson}: ${t.personN(i + 1)}`}
            variant="link"
            destructive
            onPress={() => setRows(rows.filter((_, j) => j !== i))}
          />
        </Card>
      ))}
      {rows.length < max ? (
        <Button label={t.addPerson} variant="secondary" onPress={() => setRows([...rows, {}])} />
      ) : null}
    </Group>
  );
}
