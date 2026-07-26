"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  deleteBudgetAction,
  getBudgetProgressAction,
  upsertBudgetAction,
} from "@/actions/budgets.actions";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { budgetAlertLabels, formatCurrency } from "@/lib/format-display";

export function BudgetsView() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [budgets, setBudgets] = useState<Array<{
    id: string;
    categoryName: string | null;
    amount: string;
    spentAmount?: string;
    usedPercent?: string;
    alertLevel?: string;
  }>>([]);
  const [expenseCategories, setExpenseCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const loadBudgets = useCallback(() => {
    startTransition(async () => {
      const [progressResult, categoriesResult] = await Promise.all([
        getBudgetProgressAction({ year, month }),
        listCategoriesAction("EXPENSE"),
      ]);

      if (!progressResult.ok) {
        toast.error(progressResult.error);
        return;
      }
      if (!categoriesResult.ok) {
        toast.error(categoriesResult.error);
        return;
      }

      setBudgets(progressResult.data);
      setExpenseCategories(categoriesResult.data);
    });
  }, [year, month]);

  useEffect(() => {
    loadBudgets();
  }, [loadBudgets]);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await upsertBudgetAction({
        categoryId: String(formData.get("categoryId") ?? ""),
        year,
        month,
        amount: String(formData.get("amount") ?? ""),
        isRecurringTemplate: formData.get("isRecurringTemplate") === "on",
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("Presupuesto guardado");
      setDialogOpen(false);
      loadBudgets();
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteBudgetAction(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Presupuesto eliminado");
      loadBudgets();
    });
  }

  return (
    <AppShell currentPath="/budgets">
      <PageHeader
        title="Presupuestos"
        description="Compara lo gastado vs lo presupuestado por categoría."
        action={
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            Definir presupuesto
          </Button>
        }
      />

      <Card className="mb-4">
        <CardContent className="grid grid-cols-2 gap-3 p-4">
          <div className="space-y-2">
            <Label htmlFor="year">Año</Label>
            <Input
              id="year"
              type="number"
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="month">Mes</Label>
            <Input
              id="month"
              type="number"
              min={1}
              max={12}
              value={month}
              onChange={(event) => setMonth(Number(event.target.value))}
            />
          </div>
        </CardContent>
      </Card>

      {budgets.length === 0 ? (
        <EmptyState
          title="Sin presupuestos este mes"
          description="Define cuánto quieres gastar por categoría para detectar sobregiros."
          action={<Button onClick={() => setDialogOpen(true)}>Crear presupuesto</Button>}
        />
      ) : (
        <div className="space-y-3">
          {budgets.map((budget) => {
            const used = Number(budget.usedPercent ?? 0);
            return (
              <Card key={budget.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{budget.categoryName}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(budget.spentAmount ?? "0")} de{" "}
                        {formatCurrency(budget.amount)}
                      </p>
                    </div>
                    <Badge
                      variant={
                        budget.alertLevel === "OVER"
                          ? "danger"
                          : budget.alertLevel === "WARNING"
                            ? "warning"
                            : "success"
                      }
                    >
                      {budgetAlertLabels[budget.alertLevel ?? "OK"]}
                    </Badge>
                  </div>
                  <Progress
                    value={Math.min(used, 100)}
                    indicatorClassName={
                      used >= 100
                        ? "bg-red-500"
                        : used >= 80
                          ? "bg-amber-500"
                          : undefined
                    }
                  />
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(budget.id)}>
                    Eliminar
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Presupuesto mensual</DialogTitle>
          </DialogHeader>
          <form action={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="categoryId">Categoría</Label>
              <select
                id="categoryId"
                name="categoryId"
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                required
              >
                {expenseCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Monto máximo</Label>
              <Input id="amount" name="amount" required />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isRecurringTemplate" />
              Repetir automáticamente cada mes
            </label>
            <Button type="submit" className="w-full" disabled={isPending}>
              Guardar
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
