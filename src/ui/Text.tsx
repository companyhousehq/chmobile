import { Text as RNText, type TextProps } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { type as typeScale, weight, type ColorTokens } from "@/theme/tokens";

interface Props extends TextProps {
  variant?: keyof typeof typeScale;
  tone?: keyof Pick<ColorTokens, "text" | "text2" | "text3" | "textMuted" | "accent" | "dangerFg">;
  bold?: boolean;
  /** Cap Dynamic Type growth, for dense list rows only. */
  dense?: boolean;
}

/** Scales with Dynamic Type and Android font scale (allowFontScaling is on by default). */
export function Text({ variant = "body", tone = "text", bold, dense, style, ...rest }: Props) {
  const { c } = useTheme();
  return (
    <RNText
      maxFontSizeMultiplier={dense ? 1.6 : undefined}
      {...rest}
      style={[
        typeScale[variant],
        { color: c[tone], fontWeight: bold ? weight.semibold : weight.regular },
        style,
      ]}
    />
  );
}
