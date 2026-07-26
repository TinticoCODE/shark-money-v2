"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { getDashboardSummaryAction } from "@/actions/dashboard.actions";
import { getCreditCardDashboardSummaryAction } from "@/actions/credit-cards.actions";
import { logoutAction } from "@/actions/auth.actions";
import { AppShell } from "@/components/layout/app-shell";
import { FabQuickActions } from "@/components/shared/fab-quick-actions";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCardPaymentModal } from "@/features/dashboard/credit-card-payment-modal";
import { TransactionQuickModal } from "@/features/dashboard/transaction-quick-modal";
import { creditCardDebtLabels, formatCurrency, healthLabels } from "@/lib/format-display";
import type * as dashboardService from "@/services/dashboard.service";

type DashboardSummary = Awaited<ReturnType<typeof dashboardService.getDashboardSummary>>;
import type * as creditCardService from "@/services/credit-card.service";

type CreditCardDashboard = Awaited<
  ReturnType<typeof creditCardService.getCreditCardDashboardSummary>
>;

const CHART_COLORS = ["#0f766e", "#0284c7", "#7c3aed", "#db2777", "#ea580c", "#65a30d"];

export function DashboardView() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [creditCards, setCreditCards] = useState<CreditCardDashboard | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [quickType, setQuickType] = useState<"INCOME" | "EXPENSE" | null>(null);
  const [payCardOpen, setPayCardOpen] = useState(false);
  const [, startTransition] = useTransition();

  const loadSummary = useCallback(() => {
    startTransition(async () => {
      const [summaryResult, cardsResult] = await Promise.all([
        getDashboardSummaryAction(),
        getCreditCardDashboardSummaryAction(),
      ]);

      if (!summaryResult.ok) {
        setLoadError(summaryResult.error);
        toast.error(summaryResult.error);
        return;
      }
      if (cardsResult.ok) {
        setCreditCards(cardsResult.data);
      }
      setLoadError(null);
      setSummary(summaryResult.data);
    });
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  if (!summary) {
    return (
      <AppShell currentPath="/dashboard">
        <p className="text-sm text-muted-foreground">
          {loadError ?? "Cargando dashboard..."}
        </p>
        <FabQuickActions
          onIncome={() => setQuickType("INCOME")}
          onExpense={() => setQuickType("EXPENSE")}
          onPayCreditCard={() => setPayCardOpen(true)}
        />
        <CreditCardPaymentModal
          open={payCardOpen}
          onOpenChange={setPayCardOpen}
          onSuccess={loadSummary}
        />
        <TransactionQuickModal
          open={quickType !== null}
          type={quickType ?? "EXPENSE"}
          onOpenChange={(open) => {
            if (!open) setQuickType(null);
          }}
          onSuccess={loadSummary}
        />
      </AppShell>
    );
  }

  const healthVariant =
    summary.healthScore.label === "AT_RISK"
      ? "danger"
      : summary.healthScore.label === "FAIR"
        ? "warning"
        : "success";

  return (
    <AppShell currentPath="/dashboard">
      <PageHeader
        title="Dashboard"
        description="Resumen del mes con salud financiera e insights accionables."
        action={
          <form action={logoutAction}>
            <Button variant="outline" size="sm" type="submit">
              Salir
            </Button>
          </form>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Ingresos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {formatCurrency(summary.summary.totalIncome, summary.currency)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Gastos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {formatCurrency(summary.summary.totalExpenses, summary.currency)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Tasa de ahorro</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{summary.summary.savingsRatePercent}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Capacidad disponible</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {formatCurrency(summary.summary.availableSavings, summary.currency)}
            </p>
          </CardContent>
        </Card>
      </div>

      {creditCards && creditCards.activeDebts.length > 0 ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Deudas activas (tarjetas)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {creditCards.activeDebts.map((card) => (
                <div
                  key={card.id}
                  className="flex items-center justify-between rounded-lg border border-border/70 p-3"
                >
                  <div>
                    <p className="font-medium">{card.name}</p>
                    <Badge variant="secondary">
                      {creditCardDebtLabels[card.debtStatus] ?? card.debtStatus}
                    </Badge>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-semibold">{formatCurrency(card.usedBalance, summary.currency)}</p>
                    <p className="text-muted-foreground">
                      Pagar: {formatCurrency(card.suggestedPaymentAmount, summary.currency)}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Compromiso futuro tarjetas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">
                {formatCurrency(creditCards.totalFutureCommitment, summary.currency)}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Cuotas MSI y con interés pendientes; no duplica los gastos reales del mes.
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Evolución mensual</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={summary.monthlySeries}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => formatCurrency(String(value ?? 0), summary.currency)} />
                <Line type="monotone" dataKey="income" stroke="#0f766e" strokeWidth={2} name="Ingresos" />
                <Line type="monotone" dataKey="expenses" stroke="#dc2626" strokeWidth={2} name="Gastos" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Salud financiera</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-4xl font-semibold">{summary.healthScore.score}</p>
              <Badge variant={healthVariant}>
                {healthLabels[summary.healthScore.label] ?? summary.healthScore.label}
              </Badge>
            </div>
            <div className="space-y-2 text-sm">
              <p>Ritmo presupuesto: {summary.budgetHealth.riskLevel}</p>
              <p>
                Presupuesto usado: {summary.budgetHealth.budgetUsedPercent}% · Mes transcurrido:{" "}
                {summary.budgetHealth.monthElapsedPercent}%
              </p>
              {summary.budgetHealth.isAheadOfPace ? (
                <p className="text-amber-700">
                  Vas adelantado al ritmo esperado para este día del mes.
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Gastos por categoría</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {summary.expenseByCategory.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aún no hay gastos este mes.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={summary.expenseByCategory}
                    dataKey="amount"
                    nameKey="categoryName"
                    innerRadius={55}
                    outerRadius={90}
                  >
                    {summary.expenseByCategory.map((entry, index) => (
                      <Cell key={entry.categoryId} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(String(value ?? 0), summary.currency)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Alertas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {summary.alerts.spendingAnomalies.length === 0 &&
            summary.alerts.overdueLoansCount === 0 &&
            summary.alerts.behindScheduleGoalsCount === 0 ? (
              <p className="text-muted-foreground">No hay alertas activas por ahora.</p>
            ) : null}
            {summary.alerts.spendingAnomalies.map((anomaly) => (
              <div key={anomaly.categoryId} className="rounded-lg bg-amber-50 p-3 text-amber-900">
                Gasto inusual en {anomaly.categoryName}:{" "}
                {formatCurrency(anomaly.currentMonthSpent, summary.currency)}
              </div>
            ))}
            {summary.alerts.overdueLoansCount > 0 ? (
              <div className="rounded-lg bg-red-50 p-3 text-red-800">
                Tienes {summary.alerts.overdueLoansCount} préstamo(s) vencido(s).
              </div>
            ) : null}
            {summary.alerts.behindScheduleGoalsCount > 0 ? (
              <div className="rounded-lg bg-amber-50 p-3 text-amber-900">
                {summary.alerts.behindScheduleGoalsCount} meta(s) fuera de plazo proyectado.
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <FabQuickActions
        onIncome={() => setQuickType("INCOME")}
        onExpense={() => setQuickType("EXPENSE")}
        onPayCreditCard={() => setPayCardOpen(true)}
      />

      <CreditCardPaymentModal
        open={payCardOpen}
        onOpenChange={setPayCardOpen}
        onSuccess={loadSummary}
      />

      <TransactionQuickModal
        open={quickType !== null}
        type={quickType ?? "EXPENSE"}
        onOpenChange={(open) => {
          if (!open) setQuickType(null);
        }}
        onSuccess={loadSummary}
      />
    </AppShell>
  );
}
