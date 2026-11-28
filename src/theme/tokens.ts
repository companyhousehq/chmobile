/**
 * Mobile design tokens (ADR 0030, design 11). Plain data, owned by the app.
 * Light values are the web palette (companyhousefe globals.css and app.css)
 * with the CSS variables resolved. The dark palette is new work pending design
 * sign-off. Components style only from these tokens: no hex colours elsewhere.
 */
import { Platform, type TextStyle, type ViewStyle } from "react-native";

export interface ColorTokens {
  surface: string;
  surface2: string;
  canvas: string;
  border: string;
  borderStrong: string;
  divider: string;
  text: string;
  text2: string;
  text3: string;
  textMuted: string;
  textFaint: string;
  accent: string;
  accentStrong: string;
  accentSoft: string;
  accentSoft2: string;
  accentTint: string;
  /** Text and icons on an `accent` fill. */
  onAccent: string;
  forest: string;
  forestDeep: string;
  forestLine: string;
  forestText: string;
  forestMuted: string;
  forestAccent: string;
  forestFrame: string;
  successBg: string;
  successFg: string;
  successLine: string;
  warningBg: string;
  warningFg: string;
  warningLine: string;
  dangerBg: string;
  dangerFg: string;
  dangerLine: string;
  dangerSolid: string;
  /** Text on a `dangerSolid` fill. */
  onDanger: string;
  infoBg: string;
  infoFg: string;
  infoLine: string;
  neutralBg: string;
  neutralFg: string;
  neutralLine: string;
  overlay: string;
}

const light: ColorTokens = {
  surface: "#ffffff",
  surface2: "#fafbfa",
  canvas: "#f7f8f6",
  border: "#e3e8e5",
  borderStrong: "#cdd6d1",
  divider: "#eef1ef",
  text: "#0f1a15",
  text2: "#2e3a34",
  text3: "#4a5650",
  textMuted: "#5a6660",
  // Web is #6b7570 (4.48:1 on canvas); darkened a step to meet AA on every surface.
  textFaint: "#68726d",
  accent: "#00764a",
  accentStrong: "#0b3d2c",
  accentSoft: "#e8f3ec",
  accentSoft2: "#d6eadd",
  accentTint: "#f5faf7",
  onAccent: "#ffffff",
  forest: "#0b3d2c",
  forestDeep: "#08301f",
  forestLine: "rgba(255, 255, 255, 0.14)",
  forestText: "#c6dbd0",
  forestMuted: "#9cc3b0",
  forestAccent: "#7fd1a8",
  forestFrame: "#1c5440",
  successBg: "#e6f2eb",
  successFg: "#0b6b43",
  successLine: "#c4e0cf",
  warningBg: "#fdf3e4",
  warningFg: "#8a4b08",
  warningLine: "#f0d6ad",
  dangerBg: "#fdf2f2",
  dangerFg: "#a01c1c",
  dangerLine: "#f0c6c6",
  dangerSolid: "#b42318",
  onDanger: "#ffffff",
  infoBg: "#eef4f1",
  // The web renders info banners with text-2 on info-bg and the standard border.
  infoFg: "#2e3a34",
  infoLine: "#e3e8e5",
  neutralBg: "#eef1ef",
  neutralFg: "#3e4a44",
  neutralLine: "#e3e8e5",
  overlay: "rgba(15, 26, 21, 0.42)",
};

const dark: ColorTokens = {
  surface: "#14231c",
  surface2: "#1a2d24",
  canvas: "#0f1a15",
  border: "#27392f",
  borderStrong: "#37503f",
  divider: "#1e3027",
  text: "#e8eeeb",
  text2: "#c6dbd0",
  text3: "#b0cfc0",
  textMuted: "#9cc3b0",
  textFaint: "#8db3a1",
  accent: "#7fd1a8",
  accentStrong: "#a9e6c8",
  accentSoft: "#17372a",
  accentSoft2: "#1f4a38",
  accentTint: "#122a20",
  onAccent: "#08301f",
  forest: "#0b3d2c",
  forestDeep: "#08301f",
  forestLine: "rgba(255, 255, 255, 0.14)",
  forestText: "#c6dbd0",
  forestMuted: "#9cc3b0",
  forestAccent: "#7fd1a8",
  forestFrame: "#1c5440",
  successBg: "#12301f",
  successFg: "#8fe0b3",
  successLine: "#1f5a3a",
  warningBg: "#3a2a10",
  warningFg: "#f3c27a",
  warningLine: "#5c4318",
  dangerBg: "#3a1717",
  dangerFg: "#f5a3a3",
  dangerLine: "#6b2a2a",
  dangerSolid: "#b42318",
  onDanger: "#ffffff",
  infoBg: "#162a21",
  infoFg: "#c6dbd0",
  infoLine: "#27392f",
  neutralBg: "#1e3027",
  neutralFg: "#c6dbd0",
  neutralLine: "#27392f",
  overlay: "rgba(0, 0, 0, 0.6)",
};

export const color = { light, dark } as const;
export type ColorScheme = keyof typeof color;

export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 32, 8: 48 } as const;

export const radius = { xs: 4, sm: 6, md: 8, lg: 12 } as const;

export const weight = { regular: "400", medium: "500", semibold: "600" } as const;

/** Mobile type scale in points (design 11). */
export const type = {
  caption: { fontSize: 12, lineHeight: 16 },
  footnote: { fontSize: 13, lineHeight: 18 },
  body: { fontSize: 15, lineHeight: 22 },
  callout: { fontSize: 16, lineHeight: 22 },
  title3: { fontSize: 18, lineHeight: 24 },
  title2: { fontSize: 22, lineHeight: 28 },
  title1: { fontSize: 28, lineHeight: 34 },
} as const satisfies Record<string, Pick<TextStyle, "fontSize" | "lineHeight">>;

/**
 * Geist Sans and Geist Mono are not bundled yet (design 11 plans four font
 * files via expo-font); until then the system faces stand in.
 */
export const font = {
  sans: Platform.select({ ios: "System", default: "sans-serif" }),
  mono: Platform.select({ ios: "Menlo", default: "monospace" }),
} as const;

/** Touch-sized controls: the web's 32 and 40 px are too small for a thumb. */
export const control = { minTarget: 44, buttonHeight: 44, buttonHeightLarge: 52 } as const;

/** Maximum Dynamic Type growth for dense list rows. */
export const maxFontScaleDense = 1.6;

type Elevation = Pick<
  ViewStyle,
  "shadowColor" | "shadowOffset" | "shadowOpacity" | "shadowRadius" | "elevation"
>;

export const elevation = {
  shadow1: {
    shadowColor: "#0f1a15",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  shadow2: {
    shadowColor: "#0b3d2c",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 3,
  },
  shadowPop: {
    shadowColor: "#0b3d2c",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.2,
    shadowRadius: 32,
    elevation: 8,
  },
} as const satisfies Record<string, Elevation>;

export const tokens = { color, space, radius, weight, type, font, control, elevation };
