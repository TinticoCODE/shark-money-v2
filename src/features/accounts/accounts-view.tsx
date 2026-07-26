"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createAccountAction,
  deactivateAccountAction,
  deleteAccountAction,
  listAccountsAction,
  updateAccountAction,
} from "@/actions/accounts.actions";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
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
import { AppShell } from "@/components/layout/app-shell";
import { accountTypeLabels, formatCurrency } from "@/lib/format-display";

type Account = {
  id: string;
  name: string;
  type: string;
  balance: string;
  isActive: boolean;
};

const accountTypes = ["CASH", "BANK", "DIGITAL_WALLET", "SAVINGS"] as const;

export function AccountsView() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadAccounts = useCallback(() => {
    startTransition(async () => {
      const result = await listAccountsAction(true);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setAccounts(result.data);
    });
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  function openCreateDialog() {
    setEditingAccount(null);
    setDialogOpen(true);
  }

  function openEditDialog(account: Account) {
    setEditingAccount(account);
    setDialogOpen(true);
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const payload = {
        name: String(formData.get("name") ?? ""),
        type: String(formData.get("type") ?? "CASH"),
        initialBalance: String(formData.get("initialBalance") ?? "0"),
      };

      if (editingAccount) {
        const result = await updateAccountAction({
          id: editingAccount.id,
          name: payload.name,
          type: payload.type as Account["type"],
        });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success("Cuenta actualizada");
      } else {
        const result = await createAccountAction(payload);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success("Cuenta creada");
      }

      setDialogOpen(false);
      loadAccounts();
    });
  }

  function handleDeactivate(id: string) {
    startTransition(async () => {
      const result = await deactivateAccountAction(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Cuenta desactivada");
      loadAccounts();
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteAccountAction(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Cuenta eliminada");
      loadAccounts();
    });
  }

  return (
    <AppShell currentPath="/accounts">
      <PageHeader
        title="Cuentas"
        description="Administra tus cuentas y consulta el balance actualizado."
        action={
          <Button onClick={openCreateDialog} size="sm">
            Nueva cuenta
          </Button>
        }
      />

      {accounts.length === 0 ? (
        <EmptyState
          title="Sin cuentas todavía"
          description="Crea tu primera cuenta para empezar a registrar movimientos."
          action={<Button onClick={openCreateDialog}>Crear cuenta</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {accounts.map((account) => (
            <Card key={account.id} className={!account.isActive ? "opacity-60" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{account.name}</CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {accountTypeLabels[account.type] ?? account.type}
                    </p>
                  </div>
                  {!account.isActive ? <Badge variant="secondary">Inactiva</Badge> : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-2xl font-semibold tracking-tight">
                  {formatCurrency(account.balance)}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/accounts/${account.id}`}>Ver detalle</Link>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => openEditDialog(account)}>
                    Editar
                  </Button>
                  {account.isActive ? (
                    <Button variant="ghost" size="sm" onClick={() => handleDeactivate(account.id)}>
                      Desactivar
                    </Button>
                  ) : null}
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(account.id)}>
                    Eliminar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAccount ? "Editar cuenta" : "Nueva cuenta"}</DialogTitle>
            <DialogDescription>
              {editingAccount
                ? "Actualiza el nombre o tipo de la cuenta."
                : "Registra una cuenta con su balance inicial."}
            </DialogDescription>
          </DialogHeader>
          <form action={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                name="name"
                defaultValue={editingAccount?.name ?? ""}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Tipo</Label>
              <select
                id="type"
                name="type"
                defaultValue={editingAccount?.type ?? "CASH"}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              >
                {accountTypes.map((type) => (
                  <option key={type} value={type}>
                    {accountTypeLabels[type]}
                  </option>
                ))}
              </select>
            </div>
            {!editingAccount ? (
              <div className="space-y-2">
                <Label htmlFor="initialBalance">Balance inicial</Label>
                <Input id="initialBalance" name="initialBalance" defaultValue="0" />
              </div>
            ) : null}
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "Guardando..." : "Guardar"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
