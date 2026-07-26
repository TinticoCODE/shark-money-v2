"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { createTransactionAction } from "@/actions/transactions.actions";
import {
  listCreditCardsAction,
  previewInstallmentPlanAction,
  registerCreditCardPurchaseAction,
} from "@/actions/credit-cards.actions";
import { listAccountsAction } from "@/actions/accounts.actions";
import { listCategoriesAction } from "@/actions/categories.actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TransactionQuickModalProps {
  open: boolean;
  type: "INCOME" | "EXPENSE";
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function TransactionQuickModal({
  open,
  type,
  onOpenChange,
  onSuccess,
}: TransactionQuickModalProps) {
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string }>>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [creditCards, setCreditCards] = useState<Array<{ id: string; name: string }>>([]);
  const [paymentMethod, setPaymentMethod] = useState<"ACCOUNT" | "CREDIT_CARD">("ACCOUNT");
  const [installmentsCount, setInstallmentsCount] = useState(1);
  const [interestPreview, setInterestPreview] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;

    startTransition(async () => {
      const [accountsResult, categoriesResult, cardsResult] = await Promise.all([
        listAccountsAction(false),
        listCategoriesAction(type),
        type === "EXPENSE" ? listCreditCardsAction(false) : Promise.resolve({ ok: true as const, data: [] }),
      ]);

      if (accountsResult.ok) {
        setAccounts(accountsResult.data.map((account) => ({ id: account.id, name: account.name })));
      }
      if (categoriesResult.ok) {
        setCategories(categoriesResult.data);
      }
      if (cardsResult.ok) {
        setCreditCards(cardsResult.data.map((card) => ({ id: card.id, name: card.name })));
      }
    });
  }, [open, type]);

  useEffect(() => {
    if (!open || type !== "EXPENSE" || paymentMethod !== "CREDIT_CARD") {
      setInterestPreview(null);
      return;
    }

    const cardId = creditCards[0]?.id;
    if (!cardId) return;

    startTransition(async () => {
      const result = await previewInstallmentPlanAction({
        creditCardId: cardId,
        amount: "100000",
        purchaseDate: new Date(),
        installmentsCount,
      });
      if (result.ok) {
        setInterestPreview(
          result.data.isInterestFree
            ? "Esta opción es sin intereses (MSI o contado)."
            : "Esta opción genera intereses según la tasa mensual de la tarjeta.",
        );
      }
    });
  }, [open, type, paymentMethod, installmentsCount, creditCards]);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      if (type === "EXPENSE" && paymentMethod === "CREDIT_CARD") {
        const result = await registerCreditCardPurchaseAction({
          creditCardId: String(formData.get("creditCardId") ?? ""),
          categoryId: String(formData.get("categoryId") ?? ""),
          amount: String(formData.get("amount") ?? ""),
          purchaseDate: new Date(String(formData.get("date") ?? "")),
          installmentsCount: Number(formData.get("installmentsCount") ?? 1),
          description: String(formData.get("description") ?? "") || null,
        });

        if (!result.ok) {
          toast.error(result.error);
          return;
        }

        toast.success("Compra con tarjeta registrada");
        onOpenChange(false);
        onSuccess();
        return;
      }

      const result = await createTransactionAction({
        type,
        amount: String(formData.get("amount") ?? ""),
        accountId: String(formData.get("accountId") ?? ""),
        categoryId: String(formData.get("categoryId") ?? ""),
        date: new Date(String(formData.get("date") ?? "")),
        description: String(formData.get("description") ?? ""),
        isRecurring: formData.get("isRecurring") === "on",
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(type === "INCOME" ? "Ingreso registrado" : "Gasto registrado");
      onOpenChange(false);
      onSuccess();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {type === "INCOME" ? "Registrar ingreso" : "Registrar gasto"}
          </DialogTitle>
          <DialogDescription>Formulario rápido sin salir del dashboard.</DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="quick-amount">Monto</Label>
            <Input id="quick-amount" name="amount" required />
          </div>

          {type === "EXPENSE" ? (
            <div className="space-y-2">
              <Label htmlFor="paymentMethod">Método de pago</Label>
              <select
                id="paymentMethod"
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                value={paymentMethod}
                onChange={(event) =>
                  setPaymentMethod(event.target.value as "ACCOUNT" | "CREDIT_CARD")
                }
              >
                <option value="ACCOUNT">Cuenta</option>
                <option value="CREDIT_CARD">Tarjeta de crédito</option>
              </select>
            </div>
          ) : null}

          {type === "EXPENSE" && paymentMethod === "CREDIT_CARD" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="creditCardId">Tarjeta</Label>
                <select
                  id="creditCardId"
                  name="creditCardId"
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  required
                >
                  {creditCards.map((card) => (
                    <option key={card.id} value={card.id}>
                      {card.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="installmentsCount">Cuotas</Label>
                <Input
                  id="installmentsCount"
                  name="installmentsCount"
                  type="number"
                  min={1}
                  value={installmentsCount}
                  onChange={(event) => setInstallmentsCount(Number(event.target.value))}
                  required
                />
              </div>
              {interestPreview ? (
                <p className="text-sm text-muted-foreground">{interestPreview}</p>
              ) : null}
            </>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="quick-accountId">Cuenta</Label>
              <select
                id="quick-accountId"
                name="accountId"
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                required={type === "INCOME" || paymentMethod === "ACCOUNT"}
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="quick-categoryId">Categoría</Label>
            <select
              id="quick-categoryId"
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
            <Label htmlFor="quick-date">Fecha</Label>
            <Input
              id="quick-date"
              name="date"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quick-description">Descripción</Label>
            <Input id="quick-description" name="description" />
          </div>
          {type === "EXPENSE" && paymentMethod === "ACCOUNT" ? (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isRecurring" />
              Gasto fijo recurrente
            </label>
          ) : null}
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Guardando..." : "Guardar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
