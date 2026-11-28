import { View } from "react-native";
import {
  EXPIRY_PRESETS,
  categoryLabel,
  scopeLabel,
  toggleScope,
  type AuthorizationCatalogue,
  type CatalogueScope,
  type ExpiryPreset,
} from "@/lib/authorizations";
import { strings } from "@/strings";
import { space } from "@/theme/tokens";
import { Badge } from "@/ui/Badge";
import { Checkbox } from "@/ui/Checkbox";
import { Chips } from "@/ui/Chips";
import { MultiChips } from "@/ui/MultiChips";
import { Notice } from "@/ui/Notice";
import { Text } from "@/ui/Text";
import { TextField } from "@/ui/TextField";

const t = strings.az;

/** Rule 8: on every screen that requests, reviews, grants or manages access (AC43). */
export function AuthNote() {
  return <Notice>{t.independence}</Notice>;
}

export function SectionLabel({ children }: { children: string }) {
  return (
    <Text variant="footnote" tone="text2" bold accessibilityRole="header">
      {children}
    </Text>
  );
}

/** Checkbox list of what can be done. Choosing an edit option also chooses the view option it needs. */
export function ScopePicker({
  label,
  options,
  value,
  onChange,
  error,
}: {
  label: string;
  options: CatalogueScope[];
  value: string[];
  onChange: (v: string[]) => void;
  error?: string;
}) {
  return (
    <View accessibilityLabel={label} style={{ gap: space[2] }}>
      <SectionLabel>{label}</SectionLabel>
      {options.map((o) => (
        <Checkbox
          key={o.key}
          checked={value.includes(o.key)}
          label={o.label}
          onChange={(on) => onChange(toggleScope(value, o.key, on, options))}
        >
          <Text bold>{o.label}</Text>
          {o.description ? (
            <Text variant="footnote" tone="textMuted">
              {o.description}
            </Text>
          ) : null}
        </Checkbox>
      ))}
      {error ? (
        <Text variant="footnote" tone="dangerFg" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function CategoryPicker({
  label,
  options,
  value,
  onChange,
  error,
}: {
  label: string;
  options: { key: string; label: string }[];
  value: string[];
  onChange: (v: string[]) => void;
  error?: string;
}) {
  return (
    <View style={{ gap: space[2] }}>
      <SectionLabel>{label}</SectionLabel>
      <MultiChips
        label={label}
        options={options.map((o) => ({ value: o.key, label: o.label }))}
        value={value}
        onChange={onChange}
      />
      {error ? (
        <Text variant="footnote" tone="dangerFg" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/** Ongoing, 3 months, 6 months, 1 year, or a typed date. */
export function ExpiryPicker({
  preset,
  onPreset,
  date,
  onDate,
  error,
  withNone = true,
}: {
  withNone?: boolean;
  preset: ExpiryPreset;
  onPreset: (p: ExpiryPreset) => void;
  date: string;
  onDate: (d: string) => void;
  error?: string;
}) {
  return (
    <View style={{ gap: space[2] }}>
      <SectionLabel>{t.expiryTitle}</SectionLabel>
      <Chips
        label={t.expiryTitle}
        options={EXPIRY_PRESETS.filter((p) => withNone || p.value !== "none")}
        value={preset}
        onChange={onPreset}
      />
      {preset === "custom" ? (
        <TextField
          label={t.company.endDate}
          hint={t.company.endDateHint}
          value={date}
          onChangeText={onDate}
          keyboardType="numbers-and-punctuation"
          autoCorrect={false}
          error={error}
        />
      ) : error ? (
        <Text variant="footnote" tone="dangerFg">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/** What and where, as plain badges (no keys). */
export function AccessBadges({
  scopes,
  categories,
  catalogue,
}: {
  scopes: readonly string[];
  categories: readonly string[];
  catalogue?: AuthorizationCatalogue | null;
}) {
  return (
    <View style={{ gap: space[2] }}>
      {scopes.map((s) => (
        <Text key={s} variant="footnote" tone="text2">
          {`• ${scopeLabel(s, catalogue?.action_scopes)}`}
        </Text>
      ))}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
        {categories.map((c) => (
          <Badge key={c} label={categoryLabel(c, catalogue?.service_categories)} />
        ))}
      </View>
    </View>
  );
}
