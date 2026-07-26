"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  activateCreditCardAction,
  deactivateCreditCardAction,
  deleteCreditCardPaymentAction,
  deleteCreditCardPurchaseAction,
  getCreditCardAction,
  registerCreditCardPaymentAction,
  registerCreditCardPurchaseAction,
} from "@/actions/credit-cards.actions";
import { listAccountsAction } from "@/actions/accounts.actions";
import { listCategoriesAction } from "@/actions/categories.actions";
import { AppShell } from "@/components/layout/app-shell";
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
import { CREDIT_CARD_CYCLE_APPROXIMATION_NOTE } from "@/features/credit-cards/credit-card-cycle-note";

import type * as creditCardService from "@/services/credit-card.service";

interface CreditCardDetailViewProps {
  cardId: string;
}

type CreditCardDetail = Awaited<ReturnType<typeof creditCardService.getCreditCardById>>;

export function CreditCardDetailView({ cardId }: CreditCardDetailViewProps) {
  const [detail, setDetail] = useState<CreditCardDetail | null>(null);
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string }>>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const loadDetail = useCallback(() => {
    startTransition(async () => {
      const [detailResult, accountsResult, categoriesResult] = await Promise.all([
        getCreditCardAction(cardId),
        listAccountsAction(false),
        listCategoriesAction("EXPENSE"),
      ]);

      if (!detailResult.ok) {
        toast.error(detailResult.error);
        return;
      }
      if (accountsResult.ok) {
        setAccounts(accountsResult.data.map((account) => ({ id: account.id, name: account.name })));
      }
      if (categoriesResult.ok) {
        setCategories(categoriesResult.data);
      }
      setDetail(detailResult.data);
    });
  }, [cardId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  if (!detail) {
    return (
      <AppShell currentPath="/credit-cards">
        <p className="text-sm text-muted-foreground">Cargando tarjeta...</p>
      </AppShell>
    );
  }

  function handlePurchase(formData: FormData) {
    startTransition(async () => {
      const result = await registerCreditCardPurchaseAction({
        creditCardId: cardId,
        categoryId: String(formData.get("categoryId") ?? ""),
        amount: String(formData.get("amount") ?? ""),
        purchaseDate: new Date(String(formData.get("purchaseDate") ?? "")),
        installmentsCount: Number(formData.get("installmentsCount") ?? 1),
        description: String(formData.get("description") ?? "") || null,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("Compra registrada");
      setPurchaseOpen(false);
      loadDetail();
    });
  }

  function handlePayment(formData: FormData) {
    startTransition(async () => {
      const result = await registerCreditCardPaymentAction({
        creditCardId: cardId,
        accountId: String(formData.get("accountId") ?? ""),
        amount: String(formData.get("amount") ?? ""),
        paidAt: new Date(String(formData.get("paidAt") ?? "")),
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("Pago registrado");
      setPaymentOpen(false);
      loadDetail();
    });
  }

  function handleDeactivate() {
    startTransition(async () => {
      const result = await deactivateCreditCardAction(cardId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Tarjeta desactivada");
      loadDetail();
    });
  }

  function handleActivate() {
    startTransition(async () => {
      const result = await activateCreditCardAction(cardId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Tarjeta activada");
      loadDetail();
    });
  }

  return (
    <AppShell currentPath="/credit-cards">
      <PageHeader
        title={detail.name}
        description={`${detail.bankName ?? "Tarjeta"} · Corte día ${detail.cutoffDay}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link href="/credit-cards">Volver</Link>
            </Button>
            {detail.isActive ? (
              <>
                <Button size="sm" variant="outline" onClick={() => setPurchaseOpen(true)}>
                  Compra
                </Button>
                <Button size="sm" onClick={() => setPaymentOpen(true)}>
                  Pagar
                </Button>
                <Button size="sm" variant="ghost" disabled={isPending} onClick={handleDeactivate}>
                  Desactivar
                </Button>
              </>
            ) : (
              <>
                <Badge variant="secondary">Inactiva</Badge>
                <Button size="sm" variant="ghost" disabled={isPending} onClick={handleActivate}>
                  Activar
                </Button>
              </>
            )}
          </div>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Saldo usado</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatCurrency(detail.usedBalance)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Estado</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge>{creditCardDebtLabels[detail.debtStatus] ?? detail.debtStatus}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Pago sugerido</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {formatCurrency(detail.suggestedPaymentAmount)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Compromiso futuro</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {formatCurrency(detail.futureCommitmentAmount)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-950 dark:text-amber-100">
        <p className="font-medium">Ciclo de facturación (aproximación)</p>
        <p className="mt-1 text-muted-foreground">{CREDIT_CARD_CYCLE_APPROXIMATION_NOTE}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <p>
            <span className="text-muted-foreground">Corte modelado: </span>
            día {detail.cutoffDay}
          </p>
          <p>
            <span className="text-muted-foreground">Próximo corte: </span>
            {new Date(detail.nextCutoffDate).toLocaleDateString("es-CO")}
          </p>
          <p>
            <span className="text-muted-foreground">Pago hasta: </span>
            {new Date(detail.paymentDueDate).toLocaleDateString("es-CO")}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Compras</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {detail.purchases.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin compras registradas.</p>
            ) : (
              detail.purchases.map((purchase) => (
                <div key={purchase.id} className="rounded-lg border border-border/70 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{purchase.categoryName}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(purchase.purchaseDate).toLocaleDateString("es-CO")} ·{" "}
                        {purchase.installmentsCount} cuota(s)
                        {purchase.isInterestFree ? " · MSI" : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(purchase.amount)}</p>
                      {!purchase.isMostRecent ? (
                        <Badge variant="secondary">Solo lectura</Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="mt-1 h-8"
                          disabled={isPending}
                          onClick={() =>
                            startTransition(async () => {
                              const result = await deleteCreditCardPurchaseAction(purchase.id);
                              if (!result.ok) {
                                toast.error(result.error);
                                return;
                              }
                              toast.success("Compra eliminada");
                              loadDetail();
                            })
                          }
                        >
                          Eliminar
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pagos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {detail.payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin pagos registrados.</p>
            ) : (
              detail.payments.map((payment) => (
                <div key={payment.id} className="rounded-lg border border-border/70 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{payment.accountName}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(payment.paidAt).toLocaleDateString("es-CO")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(payment.amount)}</p>
                      {!payment.isMostRecent ? (
                        <Badge variant="secondary">Solo lectura</Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="mt-1 h-8"
                          disabled={isPending}
                          onClick={() =>
                            startTransition(async () => {
                              const result = await deleteCreditCardPaymentAction(payment.id);
                              if (!result.ok) {
                                toast.error(result.error);
                                return;
                              }
                              toast.success("Pago eliminado");
                              loadDetail();
                            })
                          }
                        >
                          Eliminar
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={purchaseOpen} onOpenChange={setPurchaseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar compra</DialogTitle>
            <DialogDescription>
              Se contabiliza como gasto real del mes; no descuenta ninguna cuenta.
            </DialogDescription>
          </DialogHeader>
          <form action={handlePurchase} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Monto</Label>
              <Input id="amount" name="amount" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="categoryId">Categoría</Label>
              <select
                id="categoryId"
                name="categoryId"
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                required
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="installmentsCount">Cuotas</Label>
              <Input id="installmentsCount" name="installmentsCount" type="number" min={1} defaultValue={1} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="purchaseDate">Fecha</Label>
              <Input
                id="purchaseDate"
                name="purchaseDate"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Input id="description" name="description" />
            </div>
            <Button type="submit" className="w-full" disabled={isPending}>
              Guardar compra
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pagar tarjeta</DialogTitle>
            <DialogDescription>
              Descuenta tu cuenta y aplica FIFO sobre las cuotas pendientes.
            </DialogDescription>
          </DialogHeader>
          <form action={handlePayment} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Monto</Label>
              <Input
                id="amount"
                name="amount"
                defaultValue={detail.suggestedPaymentAmount}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="accountId">Cuenta origen</Label>
              <select
                id="accountId"
                name="accountId"
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                required
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="paidAt">Fecha</Label>
              <Input
                id="paidAt"
                name="paidAt"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={isPending}>
              Registrar pago
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
