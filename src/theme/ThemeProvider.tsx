import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import { color, type ColorScheme, type ColorTokens } from "./tokens";

interface Theme {
  scheme: ColorScheme;
  c: ColorTokens;
}

const ThemeContext = createContext<Theme>({ scheme: "light", c: color.light });

/** Follows the device appearance (an Account > Appearance override comes later). */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const scheme: ColorScheme = system === "dark" ? "dark" : "light";
  const value = useMemo(() => ({ scheme, c: color[scheme] }), [scheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
