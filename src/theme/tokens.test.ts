import { contrastRatio } from "./contrast";
import { color, control, space, type ColorTokens } from "./tokens";

// Every text/background pair the primitives use (design 11). WCAG AA: 4.5:1.
const pairs: [fg: keyof ColorTokens, bg: keyof ColorTokens][] = [
  ["text", "surface"],
  ["text", "surface2"],
  ["text", "canvas"],
  ["text2", "surface"],
  ["text2", "canvas"],
  ["text3", "surface"],
  ["text3", "canvas"],
  ["textMuted", "surface"],
  ["textMuted", "canvas"],
  ["textFaint", "surface"],
  ["textFaint", "canvas"],
  ["accent", "surface"],
  ["accent", "canvas"],
  ["accentStrong", "accentSoft"],
  ["accentStrong", "accentSoft2"],
  ["onAccent", "accent"],
  ["onDanger", "dangerSolid"],
  ["successFg", "successBg"],
  ["warningFg", "warningBg"],
  ["dangerFg", "dangerBg"],
  ["infoFg", "infoBg"],
  ["neutralFg", "neutralBg"],
  ["forestText", "forestDeep"],
  ["forestMuted", "forestDeep"],
  ["forestAccent", "forestDeep"],
  ["forestText", "forest"],
];

describe.each(["light", "dark"] as const)("%s palette contrast", (scheme) => {
  it.each(pairs)("%s on %s is at least 4.5:1", (fg, bg) => {
    const c = color[scheme];
    expect(contrastRatio(c[fg], c[bg])).toBeGreaterThanOrEqual(4.5);
  });
});

describe("token shape", () => {
  it("has the same keys in both palettes", () => {
    expect(Object.keys(color.dark).sort()).toEqual(Object.keys(color.light).sort());
  });

  it("matches the web accent and text values", () => {
    expect(color.light.accent).toBe("#00764a");
    expect(color.light.text).toBe("#0f1a15");
  });

  it("keeps touch targets at 44 pt and spacing on the web scale", () => {
    expect(control.minTarget).toBe(44);
    expect(space[4]).toBe(16);
  });
});
