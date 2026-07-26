"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  getSettingsAction,
  updateSettingsAction,
} from "@/actions/settings.actions";
import { AppShell } from "@/components/layout/app-shell";
import { ThemeSetting } from "@/components/theme/theme-setting";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const timezoneOptions = [
  "America/Bogota",
  "America/Mexico_City",
  "America/Lima",
  "America/Santiago",
  "America/Buenos_Aires",
  "America/New_York",
  "Europe/Madrid",
  "UTC",
];

const currencyOptions = ["COP", "USD", "MXN", "EUR"];

export function SettingsView() {
  const [timezone, setTimezone] = useState("America/Bogota");
  const [currency, setCurrency] = useState("COP");
  const [isPending, startTransition] = useTransition();

  const loadSettings = useCallback(() => {
    startTransition(async () => {
      const result = await getSettingsAction();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setTimezone(result.data.timezone);
      setCurrency(result.data.currency);
    });
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updateSettingsAction({
        timezone: String(formData.get("timezone") ?? timezone),
        currency: String(formData.get("currency") ?? currency),
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("Configuración guardada");
      loadSettings();
    });
  }

  return (
    <AppShell currentPath="/settings">
      <PageHeader
        title="Configuración"
        description="Zona horaria y moneda usadas en cálculos y formatos."
      />

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Apariencia</CardTitle>
          </CardHeader>
          <CardContent>
            <ThemeSetting />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preferencias generales</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="timezone">Zona horaria (IANA)</Label>
                <select
                  id="timezone"
                  name="timezone"
                  value={timezone}
                  onChange={(event) => setTimezone(event.target.value)}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                >
                  {timezoneOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Moneda</Label>
                <select
                  id="currency"
                  name="currency"
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value)}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                >
                  {currencyOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Guardando..." : "Guardar configuración"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Categorías</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Gestiona las categorías de ingresos y gastos desde su módulo dedicado.</p>
            <Button asChild variant="outline" size="sm">
              <Link href="/categories">Ir a categorías</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
