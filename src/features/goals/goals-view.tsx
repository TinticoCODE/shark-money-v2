"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  contributeToGoalAction,
  createGoalAction,
  deleteGoalContributionAction,
  getGoalAction,
  listGoalsAction,
} from "@/actions/goals.actions";
import { listAccountsAction } from "@/actions/accounts.actions";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/format-display";
import type * as goalService from "@/services/goal.service";

type Goal = Awaited<ReturnType<typeof goalService.listGoals>>[number];
type GoalDetail = Awaited<ReturnType<typeof goalService.getGoalById>>;

export function GoalsView() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [goalDetail, setGoalDetail] = useState<GoalDetail | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [contributeOpen, setContributeOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const loadGoals = useCallback(() => {
    startTransition(async () => {
      const [goalsResult, accountsResult] = await Promise.all([
        listGoalsAction(),
        listAccountsAction(false),
      ]);

      if (!goalsResult.ok) {
        toast.error(goalsResult.error);
        return;
      }
      if (!accountsResult.ok) {
        toast.error(accountsResult.error);
        return;
      }

      setGoals(goalsResult.data);
      setAccounts(accountsResult.data.map((account) => ({ id: account.id, name: account.name })));
    });
  }, []);

  const loadGoalDetail = useCallback((goalId: string) => {
    startTransition(async () => {
      const result = await getGoalAction(goalId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setGoalDetail(result.data);
      setSelectedGoalId(goalId);
    });
  }, []);

  useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  function handleCreateGoal(formData: FormData) {
    startTransition(async () => {
      const result = await createGoalAction({
        name: String(formData.get("name") ?? ""),
        targetAmount: String(formData.get("targetAmount") ?? ""),
        targetDate: formData.get("targetDate")
          ? new Date(String(formData.get("targetDate")))
          : null,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("Meta creada");
      setCreateOpen(false);
      loadGoals();
    });
  }

  function handleContribute(formData: FormData) {
    if (!selectedGoalId) return;

    startTransition(async () => {
      const result = await contributeToGoalAction({
        goalId: selectedGoalId,
        accountId: String(formData.get("accountId") ?? ""),
        amount: String(formData.get("amount") ?? ""),
        contributedAt: new Date(String(formData.get("contributedAt") ?? "")),
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("Aporte registrado");
      setContributeOpen(false);
      loadGoals();
      loadGoalDetail(selectedGoalId);
    });
  }

  function handleDeleteContribution(contributionId: string) {
    startTransition(async () => {
      const result = await deleteGoalContributionAction(contributionId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Aporte eliminado");
      if (selectedGoalId) {
        loadGoalDetail(selectedGoalId);
      }
      loadGoals();
    });
  }

  return (
    <AppShell currentPath="/goals">
      <PageHeader
        title="Metas de ahorro"
        description="Aparta dinero con progreso y proyección automática."
        action={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            Nueva meta
          </Button>
        }
      />

      {goals.length === 0 ? (
        <EmptyState
          title="Sin metas definidas"
          description="Crea una meta para saber cuánto te falta y a qué ritmo vas."
          action={<Button onClick={() => setCreateOpen(true)}>Crear meta</Button>}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            {goals.map((goal) => (
              <Card key={goal.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{goal.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(goal.currentAmount)} de {formatCurrency(goal.targetAmount)}
                      </p>
                    </div>
                    <Badge>{goal.progressPercent}%</Badge>
                  </div>
                  <Progress value={Math.min(Number(goal.progressPercent), 100)} />
                  <Button variant="outline" size="sm" onClick={() => loadGoalDetail(goal.id)}>
                    Ver detalle
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Detalle y proyección</CardTitle>
            </CardHeader>
            <CardContent>
              {!goalDetail ? (
                <p className="text-sm text-muted-foreground">
                  Selecciona una meta para ver aportes y proyección.
                </p>
              ) : (
                <div className="space-y-4 text-sm">
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p>
                      Promedio mensual:{" "}
                      {formatCurrency(goalDetail.projection.averageMonthlyContribution)}
                    </p>
                    <p className="mt-1">
                      Fecha estimada:{" "}
                      {goalDetail.projection.estimatedCompletionDate
                        ? new Date(goalDetail.projection.estimatedCompletionDate).toLocaleDateString(
                            "es-CO",
                          )
                        : "Sin datos suficientes"}
                    </p>
                    {goalDetail.projection.isBehindSchedule ? (
                      <p className="mt-1 text-amber-700">
                        Fuera de plazo. Aporte mensual requerido:{" "}
                        {formatCurrency(goalDetail.projection.requiredMonthlyContribution ?? "0")}
                      </p>
                    ) : null}
                  </div>
                  <Button size="sm" onClick={() => setContributeOpen(true)}>
                    Registrar aporte
                  </Button>
                  <div className="space-y-3">
                    {goalDetail.contributions.map((contribution, index) => (
                      <div key={contribution.id} className="rounded-lg border border-border p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium">{formatCurrency(contribution.amount)}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(contribution.contributedAt).toLocaleDateString("es-CO")}
                            </p>
                          </div>
                          {index === 0 ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteContribution(contribution.id)}
                            >
                              Eliminar
                            </Button>
                          ) : (
                            <Badge variant="secondary">Solo lectura</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva meta</DialogTitle>
          </DialogHeader>
          <form action={handleCreateGoal} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="targetAmount">Monto objetivo</Label>
              <Input id="targetAmount" name="targetAmount" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="targetDate">Fecha objetivo (opcional)</Label>
              <Input id="targetDate" name="targetDate" type="date" />
            </div>
            <Button type="submit" className="w-full" disabled={isPending}>
              Crear meta
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={contributeOpen} onOpenChange={setContributeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar aporte</DialogTitle>
          </DialogHeader>
          <form action={handleContribute} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Monto</Label>
              <Input id="amount" name="amount" required />
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
              <Label htmlFor="contributedAt">Fecha</Label>
              <Input
                id="contributedAt"
                name="contributedAt"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={isPending}>
              Guardar aporte
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
