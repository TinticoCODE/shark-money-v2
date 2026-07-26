"use client";

import { Label } from "@/components/ui/label";
import { useTheme } from "@/components/theme/theme-provider";
import type { ThemePreference } from "@/lib/theme";

const options: Array<{ value: ThemePreference; label: string }> = [
  { value: "light", label: "Claro" },
  { value: "dark", label: "Oscuro" },
  { value: "system", label: "Sistema" },
];

export function ThemeSetting() {
  const { preference, setPreference } = useTheme();

  return (
    <div className="space-y-2">
      <Label htmlFor="theme">Apariencia</Label>
      <select
        id="theme"
        name="theme"
        value={preference}
        onChange={(event) => setPreference(event.target.value as ThemePreference)}
        className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <p className="text-xs text-muted-foreground">
        El modo oscuro se guarda en este dispositivo.
      </p>
    </div>
  );
}
