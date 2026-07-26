"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createLoanAction,
  deleteLoanPaymentAction,
  getLoanAction,
  listLoansAction,
  registerLoanPaymentAction,
} from "@/actions/loans.actions";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, loanStatusLabels } from "@/lib/format-display";
import type * as loanService from "@/services/loan.service";

type Loan = Awaited<ReturnType<typeof loanService.listLoans>>[number];
type LoanDetail = Awaited<ReturnType<typeof loanService.getLoanById>>;

export function LoansView() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [loanDetail, setLoanDetail] = useState<LoanDetail | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const loadLoans = useCallback(() => {
    startTransition(async () => {
      const [loansResult, accountsResult] = await Promise.all([
        listLoansAction(),
        listAccountsAction(false),
      ]);

      if (!loansResult.ok) {
        toast.error(loansResult.error);
        return;
      }
      if (!accountsResult.ok) {
        toast.error(accountsResult.error);
        return;
      }

      setLoans(loansResult.data);
      setAccounts(accountsResult.data.map((account) => ({ id: account.id, name: account.name })));
    });
  }, []);

  const loadLoanDetail = useCallback((loanId: string) => {
    startTransition(async () => {
      const result = await getLoanAction(loanId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setLoanDetail(result.data);
      setSelectedLoanId(loanId);
    });
  }, []);

  useEffect(() => {
    loadLoans();
  }, [loadLoans]);

  function statusVariant(status: string) {
    if (status === "PAID") return "success";
    if (status === "OVERDUE") return "danger";
    return "default";
  }

  function handleCreateLoan(formData: FormData) {
    startTransition(async () => {
      const result = await createLoanAction({
        borrowerName: String(formData.get("borrowerName") ?? ""),
        principalAmount: String(formData.get("principalAmount") ?? ""),
        sourceAccountId: String(formData.get("sourceAccountId") ?? ""),
        lentAt: new Date(String(formData.get("lentAt") ?? "")),
        dueDate: formData.get("dueDate")
          ? new Date(String(formData.get("dueDate")))
          : null,
        interestRate: String(formData.get("interestRate") ?? "") || null,
        interestType:
          String(formData.get("interestRate") ?? "") ? "SIMPLE_MONTHLY" : "NONE",
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("Préstamo registrado");
      setCreateOpen(false);
      loadLoans();
    });
  }

  function handleRegisterPayment(formData: FormData) {
    if (!selectedLoanId) return;

    startTransition(async () => {
      const result = await registerLoanPaymentAction({
        loanId: selectedLoanId,
        accountId: String(formData.get("accountId") ?? ""),
        amount: String(formData.get("amount") ?? ""),
        paidAt: new Date(String(formData.get("paidAt") ?? "")),
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("Abono registrado");
      setPaymentOpen(false);
      loadLoans();
      loadLoanDetail(selectedLoanId);
    });
  }

  function handleDeletePayment(paymentId: string) {
    startTransition(async () => {
      const result = await deleteLoanPaymentAction(paymentId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Abono eliminado");
      if (selectedLoanId) {
        loadLoanDetail(selectedLoanId);
      }
      loadLoans();
    });
  }

  return (
    <AppShell currentPath="/loans">
      <PageHeader
        title="Préstamos"
        description="Cuentas por cobrar personales con seguimiento de capital e interés."
        action={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            Nuevo préstamo
          </Button>
        }
      />

      {loans.length === 0 ? (
        <EmptyState
          title="Sin préstamos registrados"
          description="Registra dinero prestado a amigos para llevar control de abonos."
          action={<Button onClick={() => setCreateOpen(true)}>Registrar préstamo</Button>}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            {loans.map((loan) => (
              <Card
                key={loan.id}
                className={selectedLoanId === loan.id ? "ring-2 ring-primary/30" : ""}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{loan.borrowerName}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Pendiente: {formatCurrency(loan.outstandingPrincipal)}
                      </p>
                    </div>
                    <Badge variant={statusVariant(loan.status)}>
                      {loanStatusLabels[loan.status] ?? loan.status}
                    </Badge>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => loadLoanDetail(loan.id)}
                  >
                    Ver detalle
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Detalle del préstamo</CardTitle>
            </CardHeader>
            <CardContent>
              {!loanDetail ? (
                <p className="text-sm text-muted-foreground">
                  Selecciona un préstamo para ver abonos e historial.
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Capital prestado</p>
                      <p className="font-medium">{formatCurrency(loanDetail.principalAmount)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Pendiente</p>
                      <p className="font-medium">{formatCurrency(loanDetail.outstandingPrincipal)}</p>
                    </div>
                  </div>
                  <Button size="sm" onClick={() => setPaymentOpen(true)}>
                    Registrar abono
                  </Button>
                  <div className="space-y-3">
                    {loanDetail.payments.map((payment, index) => (
                      <div
                        key={payment.id}
                        className="rounded-lg border border-border p-3 text-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium">{formatCurrency(payment.totalAmount)}</p>
                            <p className="text-xs text-muted-foreground">
                              Capital {formatCurrency(payment.principalAmount)} · Interés{" "}
                              {formatCurrency(payment.interestAmount)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(payment.paidAt).toLocaleDateString("es-CO")}
                            </p>
                          </div>
                          {index === 0 ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeletePayment(payment.id)}
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
            <DialogTitle>Nuevo préstamo</DialogTitle>
            <DialogDescription>
              El monto sale de la cuenta seleccionada y no cuenta como gasto real.
            </DialogDescription>
          </DialogHeader>
          <form action={handleCreateLoan} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="borrowerName">Persona</Label>
              <Input id="borrowerName" name="borrowerName" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="principalAmount">Monto prestado</Label>
              <Input id="principalAmount" name="principalAmount" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sourceAccountId">Cuenta origen</Label>
              <select
                id="sourceAccountId"
                name="sourceAccountId"
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="lentAt">Fecha</Label>
                <Input
                  id="lentAt"
                  name="lentAt"
                  type="date"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dueDate">Fecha límite</Label>
                <Input id="dueDate" name="dueDate" type="date" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="interestRate">Tasa mensual (opcional)</Label>
              <Input id="interestRate" name="interestRate" placeholder="0.02 = 2%" />
            </div>
            <Button type="submit" className="w-full" disabled={isPending}>
              Guardar préstamo
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar abono</DialogTitle>
            <DialogDescription>
              Solo el abono más reciente puede editarse o eliminarse después.
            </DialogDescription>
          </DialogHeader>
          <form action={handleRegisterPayment} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Monto recibido</Label>
              <Input id="amount" name="amount" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="accountId">Cuenta destino</Label>
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
              Registrar abono
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
