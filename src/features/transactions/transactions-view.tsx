"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createTransactionAction,
  deleteTransactionAction,
  listTransactionsAction,
  updateTransactionAction,
} from "@/actions/transactions.actions";
import { listAccountsAction } from "@/actions/accounts.actions";
import { listCategoriesAction } from "@/actions/categories.actions";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/format-display";

type Transaction = {
  id: string;
  type: "INCOME" | "EXPENSE";
  amount: string;
  accountId: string;
  categoryId: string | null;
  categoryName: string | null;
  date: string;
  description: string | null;
  isRecurring: boolean;
};

interface TransactionsViewProps {
  initialType?: "INCOME" | "EXPENSE";
}

export function TransactionsView({ initialType }: TransactionsViewProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string }>>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string; type: string }>>([]);
  const [dialogOpen, setDialogOpen] = useState(Boolean(initialType));
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [formType, setFormType] = useState<"INCOME" | "EXPENSE">(initialType ?? "EXPENSE");
  const [filters, setFilters] = useState({
    search: "",
    accountId: "",
    categoryId: "",
    type: "",
  });
  const [isPending, startTransition] = useTransition();

  const loadData = useCallback(() => {
    startTransition(async () => {
      const [txResult, accountsResult, categoriesResult] = await Promise.all([
        listTransactionsAction({
          search: filters.search || undefined,
          accountId: filters.accountId || undefined,
          categoryId: filters.categoryId || undefined,
          type: (filters.type as "INCOME" | "EXPENSE") || undefined,
        }),
        listAccountsAction(false),
        listCategoriesAction(),
      ]);

      if (!txResult.ok) {
        toast.error(txResult.error);
        return;
      }
      if (!accountsResult.ok) {
        toast.error(accountsResult.error);
        return;
      }
      if (!categoriesResult.ok) {
        toast.error(categoriesResult.error);
        return;
      }

      setTransactions(txResult.data as Transaction[]);
      setAccounts(accountsResult.data.map((a) => ({ id: a.id, name: a.name })));
      setCategories(categoriesResult.data);
    });
  }, [filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function openCreate(type: "INCOME" | "EXPENSE") {
    setEditing(null);
    setFormType(type);
    setDialogOpen(true);
  }

  function openEdit(transaction: Transaction) {
    setEditing(transaction);
    setFormType(transaction.type);
    setDialogOpen(true);
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const payload = {
        type: formType,
        amount: String(formData.get("amount") ?? ""),
        accountId: String(formData.get("accountId") ?? ""),
        categoryId: String(formData.get("categoryId") ?? ""),
        date: new Date(String(formData.get("date") ?? "")),
        description: String(formData.get("description") ?? ""),
        isRecurring: formData.get("isRecurring") === "on",
      };

      const result = editing
        ? await updateTransactionAction({ id: editing.id, ...payload })
        : await createTransactionAction(payload);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(editing ? "Transacción actualizada" : "Transacción registrada");
      setDialogOpen(false);
      loadData();
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteTransactionAction(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Transacción eliminada");
      loadData();
    });
  }

  const filteredCategories = categories.filter((category) => category.type === formType);

  return (
    <AppShell currentPath="/transactions">
      <PageHeader
        title="Transacciones"
        description="Registra y filtra ingresos y gastos reales."
        action={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button size="sm" variant="outline" onClick={() => openCreate("INCOME")}>
              Ingreso
            </Button>
            <Button size="sm" onClick={() => openCreate("EXPENSE")}>
              Gasto
            </Button>
          </div>
        }
      />

      <Card className="mb-4">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2">
          <Input
            placeholder="Buscar por descripción"
            value={filters.search}
            onChange={(event) =>
              setFilters((current) => ({ ...current, search: event.target.value }))
            }
          />
          <select
            className="flex h-10 rounded-lg border border-input bg-background px-3 text-sm"
            value={filters.type}
            onChange={(event) =>
              setFilters((current) => ({ ...current, type: event.target.value }))
            }
          >
            <option value="">Todos los tipos</option>
            <option value="INCOME">Ingresos</option>
            <option value="EXPENSE">Gastos</option>
          </select>
          <select
            className="flex h-10 rounded-lg border border-input bg-background px-3 text-sm"
            value={filters.accountId}
            onChange={(event) =>
              setFilters((current) => ({ ...current, accountId: event.target.value }))
            }
          >
            <option value="">Todas las cuentas</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
          <select
            className="flex h-10 rounded-lg border border-input bg-background px-3 text-sm"
            value={filters.categoryId}
            onChange={(event) =>
              setFilters((current) => ({ ...current, categoryId: event.target.value }))
            }
          >
            <option value="">Todas las categorías</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {transactions.length === 0 ? (
        <EmptyState
          title="Sin transacciones"
          description="Registra tu primer ingreso o gasto para ver el historial aquí."
          action={<Button onClick={() => openCreate("EXPENSE")}>Registrar gasto</Button>}
        />
      ) : (
        <div className="space-y-3">
          {transactions.map((transaction) => (
            <Card key={transaction.id}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium break-words">
                      {transaction.description ?? transaction.categoryName ?? "Sin descripción"}
                    </p>
                    <Badge variant={transaction.type === "INCOME" ? "success" : "secondary"}>
                      {transaction.type === "INCOME" ? "Ingreso" : "Gasto"}
                    </Badge>
                    {transaction.isRecurring ? (
                      <Badge variant="warning">Fijo</Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(transaction.date).toLocaleDateString("es-CO")} ·{" "}
                    {transaction.categoryName ?? "Sin categoría"}
                  </p>
                </div>
                <div className="flex w-full items-center justify-between gap-3 border-t border-border pt-3 sm:block sm:w-auto sm:border-0 sm:pt-0 sm:text-right">
                  <p className="text-lg font-semibold sm:text-base">{formatCurrency(transaction.amount)}</p>
                  <div className="flex gap-1 sm:mt-2 sm:justify-end">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(transaction)}>
                      Editar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(transaction.id)}>
                      Eliminar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar transacción" : formType === "INCOME" ? "Registrar ingreso" : "Registrar gasto"}
            </DialogTitle>
            <DialogDescription>
              Los movimientos de préstamos, metas y transferencias se gestionan en sus módulos.
            </DialogDescription>
          </DialogHeader>
          <form action={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Monto</Label>
              <Input id="amount" name="amount" defaultValue={editing?.amount ?? ""} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="accountId">Cuenta</Label>
              <select
                id="accountId"
                name="accountId"
                defaultValue={editing?.accountId ?? accounts[0]?.id ?? ""}
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
              <Label htmlFor="categoryId">Categoría</Label>
              <select
                id="categoryId"
                name="categoryId"
                defaultValue={editing?.categoryId ?? filteredCategories[0]?.id ?? ""}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                required
              >
                {filteredCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Fecha</Label>
              <Input
                id="date"
                name="date"
                type="date"
                defaultValue={
                  editing?.date
                    ? editing.date.slice(0, 10)
                    : new Date().toISOString().slice(0, 10)
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Input
                id="description"
                name="description"
                defaultValue={editing?.description ?? ""}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="isRecurring"
                defaultChecked={editing?.isRecurring ?? false}
              />
              Gasto fijo recurrente
            </label>
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "Guardando..." : "Guardar"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
