"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  getAccountAction,
  getAccountMovementsAction,
} from "@/actions/accounts.actions";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { accountTypeLabels, formatCurrency } from "@/lib/format-display";

interface AccountDetailViewProps {
  accountId: string;
}

type AccountData = {
  id: string;
  name: string;
  type: string;
  balance: string;
  isActive: boolean;
};

type Movement = {
  id: string;
  type: string;
  amount: string;
  date: string;
  description: string | null;
  categoryName: string | null;
};

export function AccountDetailView({ accountId }: AccountDetailViewProps) {
  const [account, setAccount] = useState<AccountData | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [, startTransition] = useTransition();

  const loadData = useCallback(() => {
    startTransition(async () => {
      const [accountResult, movementsResult] = await Promise.all([
        getAccountAction(accountId),
        getAccountMovementsAction(accountId),
      ]);

      if (!accountResult.ok) {
        toast.error(accountResult.error);
        return;
      }

      if (!movementsResult.ok) {
        toast.error(movementsResult.error);
        return;
      }

      setAccount(accountResult.data);
      setMovements(movementsResult.data);
    });
  }, [accountId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (!account) {
    return (
      <AppShell currentPath="/accounts">
        <p className="text-sm text-muted-foreground">Cargando cuenta...</p>
      </AppShell>
    );
  }

  return (
    <AppShell currentPath="/accounts">
      <PageHeader
        title={account.name}
        description={accountTypeLabels[account.type] ?? account.type}
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/accounts">Volver</Link>
          </Button>
        }
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Balance actual</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold">{formatCurrency(account.balance)}</p>
          {!account.isActive ? (
            <Badge variant="secondary" className="mt-3">
              Cuenta inactiva
            </Badge>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historial de movimientos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {movements.length === 0 ? (
            <p className="text-sm text-muted-foreground">Esta cuenta aún no tiene movimientos.</p>
          ) : (
            movements.map((movement) => (
              <div
                key={movement.id}
                className="flex items-start justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0"
              >
                <div>
                  <p className="text-sm font-medium">
                    {movement.description ?? movement.categoryName ?? movement.type}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(movement.date).toLocaleDateString("es-CO")} · {movement.type}
                  </p>
                </div>
                <p className="text-sm font-semibold">{formatCurrency(movement.amount)}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
