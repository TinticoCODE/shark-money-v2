"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createCreditCardAction,
  listCreditCardsAction,
} from "@/actions/credit-cards.actions";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { creditCardDebtLabels, formatCurrency } from "@/lib/format-display";

type CreditCard = Awaited<ReturnType<typeof import("@/services/credit-card.service").listCreditCards>>[number];

function debtVariant(status: string) {
  if (status === "SIN_DEUDA") return "success";
  if (status === "DEUDA_SIN_INTERES") return "default";
  return "danger";
}

function cardStyle(card: CreditCard) {
  if (card.imageUrl) {
    return {
      backgroundImage: `linear-gradient(rgba(0,0,0,.35), rgba(0,0,0,.55)), url(${card.imageUrl})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      color: "#fff",
    } as const;
  }

  const color = card.colorHex ?? "#0f766e";
  return {
    background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 65%, black))`,
    color: "#fff",
  } as const;
}

export function CreditCardsView() {
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const loadCards = useCallback(() => {
    startTransition(async () => {
      const result = await listCreditCardsAction(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setCards(result.data);
    });
  }, []);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  function handleCreate(formData: FormData) {
    startTransition(async () => {
      const msiRaw = String(formData.get("allowedInterestFreeMonths") ?? "");
      const allowedInterestFreeMonths = msiRaw
        .split(",")
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isFinite(value) && value > 0);

      const result = await createCreditCardAction({
        name: String(formData.get("name") ?? ""),
        bankName: String(formData.get("bankName") ?? "") || null,
        lastFourDigits: String(formData.get("lastFourDigits") ?? "") || null,
        creditLimit: String(formData.get("creditLimit") ?? ""),
        cutoffDay: Number(formData.get("cutoffDay") ?? 15),
        paymentDueOffsetDays: Number(formData.get("paymentDueOffsetDays") ?? 5),
        interestRateMonthly: String(formData.get("interestRateMonthly") ?? "0"),
        allowedInterestFreeMonths,
        colorHex: String(formData.get("colorHex") ?? "#0f766e"),
        imageUrl: String(formData.get("imageUrl") ?? "") || null,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("Tarjeta creada");
      setDialogOpen(false);
      loadCards();
    });
  }

  return (
    <AppShell currentPath="/credit-cards">
      <PageHeader
        title="Tarjetas"
        description="Controla cupo, cortes, cuotas MSI y pagos sin duplicar gastos reales."
        action={
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            Nueva tarjeta
          </Button>
        }
      />

      {cards.length === 0 ? (
        <EmptyState
          title="Sin tarjetas registradas"
          description="Agrega tu primera tarjeta para registrar compras y pagos."
          action={
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              Crear tarjeta
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {cards.map((card) => (
            <Card key={card.id} className="overflow-hidden border-border/70">
              <div className="p-4" style={cardStyle(card)}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm opacity-90">{card.bankName ?? "Tarjeta"}</p>
                    <h3 className="text-lg font-semibold">{card.name}</h3>
                    {card.lastFourDigits ? (
                      <p className="text-sm opacity-90">•••• {card.lastFourDigits}</p>
                    ) : null}
                  </div>
                  <Badge variant={debtVariant(card.debtStatus)}>
                    {creditCardDebtLabels[card.debtStatus] ?? card.debtStatus}
                  </Badge>
                </div>
                <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="opacity-80">Usado</p>
                    <p className="font-semibold">{formatCurrency(card.usedBalance)}</p>
                  </div>
                  <div>
                    <p className="opacity-80">Cupo</p>
                    <p className="font-semibold">{formatCurrency(card.creditLimit)}</p>
                  </div>
                </div>
              </div>
              <CardContent className="space-y-3 pt-4">
                <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                  <p>Próximo corte: {new Date(card.nextCutoffDate).toLocaleDateString("es-CO")}</p>
                  <p>Pago hasta: {new Date(card.paymentDueDate).toLocaleDateString("es-CO")}</p>
                  <p>Sugerido sin interés: {formatCurrency(card.suggestedPaymentAmount)}</p>
                  <p>Compromiso futuro: {formatCurrency(card.futureCommitmentAmount)}</p>
                </div>
                <Button asChild size="sm" variant="outline" className="w-full">
                  <Link href={`/credit-cards/${card.id}`}>Ver detalle</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva tarjeta</DialogTitle>
            <DialogDescription>
              Configura corte, MSI permitidos y tasa mensual para cuotas con interés.
            </DialogDescription>
          </DialogHeader>
          <form action={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="bankName">Banco</Label>
                <Input id="bankName" name="bankName" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastFourDigits">Últimos 4 dígitos</Label>
                <Input id="lastFourDigits" name="lastFourDigits" maxLength={4} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="creditLimit">Cupo</Label>
              <Input id="creditLimit" name="creditLimit" required />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cutoffDay">Día de corte</Label>
                <Input id="cutoffDay" name="cutoffDay" type="number" min={1} max={31} defaultValue={15} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentDueOffsetDays">Días para pagar tras corte</Label>
                <Input
                  id="paymentDueOffsetDays"
                  name="paymentDueOffsetDays"
                  type="number"
                  min={0}
                  max={60}
                  defaultValue={5}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="interestRateMonthly">Tasa mensual (% mensual, ej. 2.878)</Label>
              <Input
                id="interestRateMonthly"
                name="interestRateMonthly"
                defaultValue="0"
                inputMode="decimal"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="allowedInterestFreeMonths">Meses MSI (separados por coma)</Label>
              <Input id="allowedInterestFreeMonths" name="allowedInterestFreeMonths" defaultValue="2,6,9" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="colorHex">Color</Label>
                <Input id="colorHex" name="colorHex" type="color" defaultValue="#0f766e" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="imageUrl">URL imagen (opcional)</Label>
                <Input id="imageUrl" name="imageUrl" type="url" placeholder="https://..." />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "Guardando..." : "Crear tarjeta"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
