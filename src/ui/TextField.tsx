import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { strings } from "@/strings";
import { useTheme } from "@/theme/ThemeProvider";
import { control, radius, space, type as typeScale } from "@/theme/tokens";
import { Text } from "./Text";

interface Props extends TextInputProps {
  label: string;
  /** Plain-language message from the API's field error or local check. */
  error?: string;
  hint?: string;
  /** Adds a show/hide control and sets secureTextEntry. */
  password?: boolean;
}

export function TextField({
  label,
  error,
  hint,
  password,
  style,
  secureTextEntry,
  ...rest
}: Props) {
  const { c } = useTheme();
  const [shown, setShown] = useState(false);
  const hidden = password ? !shown : secureTextEntry;
  return (
    <View style={styles.group}>
      <Text variant="footnote" tone="text2" bold>
        {label}
      </Text>
      <View>
        <TextInput
          accessibilityLabel={label}
          accessibilityHint={hint}
          placeholderTextColor={c.textFaint}
          {...rest}
          secureTextEntry={hidden}
          style={[
            styles.input,
            typeScale.callout,
            {
              backgroundColor: c.surface,
              borderColor: error ? c.dangerSolid : c.borderStrong,
              color: c.text,
            },
            password && styles.withToggle,
            style,
          ]}
        />
        {password ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={shown ? strings.auth.hidePassword : strings.auth.showPassword}
            onPress={() => setShown((v) => !v)}
            style={styles.toggle}
          >
            <Text variant="footnote" tone="accent" bold>
              {shown ? "Hide" : "Show"}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text variant="footnote" tone="dangerFg" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="footnote" tone="textMuted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: space[1] },
  input: {
    minHeight: control.buttonHeight,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space[3],
  },
  withToggle: { paddingRight: space[8] + space[4] },
  toggle: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    minWidth: control.minTarget,
    alignItems: "center",
    justifyContent: "center",
  },
});
