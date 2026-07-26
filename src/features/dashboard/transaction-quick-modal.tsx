"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { createTransactionAction } from "@/actions/transactions.actions";
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
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;

    startTransition(async () => {
      const [accountsResult, categoriesResult] = await Promise.all([
        listAccountsAction(false),
        listCategoriesAction(type),
      ]);

      if (accountsResult.ok) {
        setAccounts(accountsResult.data.map((account) => ({ id: account.id, name: account.name })));
      }
      if (categoriesResult.ok) {
        setCategories(categoriesResult.data);
      }
    });
  }, [open, type]);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
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
          <div className="space-y-2">
            <Label htmlFor="quick-accountId">Cuenta</Label>
            <select
              id="quick-accountId"
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
          {type === "EXPENSE" ? (
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
