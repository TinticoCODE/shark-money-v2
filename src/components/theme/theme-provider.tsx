"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Toaster } from "sonner";
import {
  APP_BACKGROUND_COLOR,
  APP_DARK_BACKGROUND_COLOR,
} from "@/lib/app-theme";
import {
  applyTheme,
  getStoredThemePreference,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from "@/lib/theme";

interface ThemeContextValue {
  preference: ThemePreference;
  resolvedTheme: "light" | "dark";
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function updateThemeMeta(resolvedTheme: "light" | "dark") {
  const themeColor = resolvedTheme === "dark" ? APP_DARK_BACKGROUND_COLOR : APP_BACKGROUND_COLOR;
  const statusBarStyle = resolvedTheme === "dark" ? "black-translucent" : "default";

  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", themeColor);

  document
    .querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')
    ?.setAttribute("content", statusBarStyle);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const stored = getStoredThemePreference();
    setPreferenceState(stored);
    const resolved = applyTheme(stored);
    setResolvedTheme(resolved);
    updateThemeMeta(resolved);
  }, []);

  useEffect(() => {
    if (preference !== "system") {
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");

    function handleChange() {
      const resolved = applyTheme("system");
      setResolvedTheme(resolved);
      updateThemeMeta(resolved);
    }

    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);

    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Ignore storage failures (private mode, etc.).
    }

    const resolved = applyTheme(next);
    setResolvedTheme(resolved);
    updateThemeMeta(resolved);
  }, []);

  const value = useMemo(
    () => ({ preference, resolvedTheme, setPreference }),
    [preference, resolvedTheme, setPreference],
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
      <Toaster richColors position="top-center" theme={resolvedTheme} />
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }

  return context;
}
