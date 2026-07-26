"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  listCreditCardsAction,
  registerCreditCardPaymentAction,
} from "@/actions/credit-cards.actions";
import { listAccountsAction } from "@/actions/accounts.actions";
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

interface CreditCardPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreditCardPaymentModal({
  open,
  onOpenChange,
  onSuccess,
}: CreditCardPaymentModalProps) {
  const [cards, setCards] = useState<
    Array<{ id: string; name: string; suggestedPaymentAmount: string }>
  >([]);
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedCardId, setSelectedCardId] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;

    startTransition(async () => {
      const [cardsResult, accountsResult] = await Promise.all([
        listCreditCardsAction(false),
        listAccountsAction(false),
      ]);

      if (cardsResult.ok) {
        setCards(
          cardsResult.data.map((card) => ({
            id: card.id,
            name: card.name,
            suggestedPaymentAmount: card.suggestedPaymentAmount,
          })),
        );
        setSelectedCardId(cardsResult.data[0]?.id ?? "");
      }
      if (accountsResult.ok) {
        setAccounts(accountsResult.data.map((account) => ({ id: account.id, name: account.name })));
      }
    });
  }, [open]);

  const selectedCard = cards.find((card) => card.id === selectedCardId);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await registerCreditCardPaymentAction({
        creditCardId: String(formData.get("creditCardId") ?? ""),
        accountId: String(formData.get("accountId") ?? ""),
        amount: String(formData.get("amount") ?? ""),
        paidAt: new Date(String(formData.get("paidAt") ?? "")),
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("Pago de tarjeta registrado");
      onOpenChange(false);
      onSuccess();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pagar tarjeta</DialogTitle>
          <DialogDescription>
            Movimiento interno: no duplica el gasto real de las compras.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="creditCardId">Tarjeta</Label>
            <select
              id="creditCardId"
              name="creditCardId"
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              required
              value={selectedCardId}
              onChange={(event) => setSelectedCardId(event.target.value)}
            >
              {cards.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pay-amount">Monto</Label>
            <Input
              id="pay-amount"
              name="amount"
              key={selectedCardId}
              defaultValue={selectedCard?.suggestedPaymentAmount ?? ""}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pay-accountId">Cuenta origen</Label>
            <select
              id="pay-accountId"
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
            <Label htmlFor="pay-paidAt">Fecha</Label>
            <Input
              id="pay-paidAt"
              name="paidAt"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={isPending || cards.length === 0}>
            {isPending ? "Guardando..." : "Registrar pago"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
