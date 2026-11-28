import * as Clipboard from "expo-clipboard";
import { usePreventRemove } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Share, StyleSheet, View } from "react-native";
import { strings } from "@/strings";
import { useTheme } from "@/theme/ThemeProvider";
import { font, radius, space } from "@/theme/tokens";
import { Button } from "@/ui/Button";
import { Checkbox } from "@/ui/Checkbox";
import { Notice } from "@/ui/Notice";
import { PrivacyScreen } from "@/ui/PrivacyScreen";
import { Text } from "@/ui/Text";

/** The clipboard copy is cleared after this long, best effort. */
const CLIPBOARD_CLEAR_MS = 60_000;

/**
 * Recovery codes, shown once (spec 0012 M13, AC16). The codes live only in the
 * `codes` prop: this component stores nothing, logs nothing, and the screen is
 * excluded from screenshots and the app-switcher snapshot. Finishing needs the
 * "I have saved these codes" tick.
 */
export function RecoveryCodes({ codes, onFinish }: { codes: string[]; onFinish: () => void }) {
  const { c } = useTheme();
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tried, setTried] = useState(false);
  // Leaving (back gesture, header back) needs the tick first.
  usePreventRemove(!saved, () => setTried(true));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        // Leaving the screen: clear the copy now rather than leave it behind.
        void Clipboard.setStringAsync("").catch(() => {});
      }
    },
    [],
  );

  const text = codes.join("\n");
  const copy = async () => {
    await Clipboard.setStringAsync(text);
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      void Clipboard.setStringAsync("").catch(() => {});
      setCopied(false);
    }, CLIPBOARD_CLEAR_MS);
  };
  const share = () => {
    void Share.share({ message: text }).catch(() => {});
  };

  return (
    <PrivacyScreen>
      <View style={{ gap: space[4] }}>
        <Text variant="title2" bold accessibilityRole="header">
          {strings.recovery.title}
        </Text>
        <Text tone="text2">{strings.recovery.body}</Text>
        <View
          accessibilityLabel={strings.recovery.title}
          style={[styles.grid, { backgroundColor: c.surface, borderColor: c.borderStrong }]}
        >
          {codes.map((code, i) => (
            <Text
              key={code}
              accessibilityLabel={`Code ${i + 1}: ${code.split("").join(" ")}`}
              style={{ fontFamily: font.mono, letterSpacing: 1 }}
              bold
            >
              {code}
            </Text>
          ))}
        </View>
        <Text variant="footnote" tone="textMuted">
          {strings.recovery.noStore}
        </Text>
        {copied ? <Notice tone="success">{strings.recovery.copied}</Notice> : null}
        <Button label={strings.recovery.copy} variant="secondary" onPress={() => void copy()} />
        <Button label={strings.recovery.share} variant="secondary" onPress={share} />
        <Checkbox checked={saved} onChange={setSaved} label={strings.recovery.saved}>
          <Text>{strings.recovery.saved}</Text>
        </Checkbox>
        {tried && !saved ? <Notice tone="warning">{strings.recovery.mustAck}</Notice> : null}
        <Button
          label={strings.recovery.finish}
          onPress={() => (saved ? onFinish() : setTried(true))}
        />
      </View>
    </PrivacyScreen>
  );
}

const styles = StyleSheet.create({
  grid: { borderWidth: 1, borderRadius: radius.md, padding: space[4], gap: space[3] },
});
