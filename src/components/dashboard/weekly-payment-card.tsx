"use client";

import * as React from "react";
import { ArrowLeftRight, Clock3, HandCoins, Wallet } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ReceiptUploadDialog } from "@/components/payments/receipt-upload-dialog";
import { AdminMarkPaidDialog } from "@/components/dashboard/admin-mark-paid-dialog";
import { WeekConfirm } from "@/components/dashboard/week-confirm";
import { useThrift } from "@/providers/thrift-provider";
import { useAuth } from "@/providers/auth-provider";
import { formatMoney, formatDate } from "@/lib/format";
import { getCurrentWeek } from "@/domain/calendar";
import { getWeekPayment, getWeeklyTarget } from "@/domain/calculations";

export function WeeklyPaymentCard() {
  const { state } = useThrift();
  const { member } = useAuth();
  const [dialogWeek, setDialogWeek] = React.useState<string | null>(null);
  const [markOpen, setMarkOpen] = React.useState(false);

  if (!state || !member) return null;

  const isAdmin = member.role === "admin";
  const currentWeek = getCurrentWeek(state.weeks);
  const weeklyTarget = currentWeek ? getWeeklyTarget(state, member.id, currentWeek) : 0;
  const currentPayment = currentWeek
    ? getWeekPayment(state.payments, member.id, currentWeek.id)
    : undefined;
  const hasPendingReceipt =
    currentPayment?.receiptStatus === "pending" || currentPayment?.status === "pending";

  return (
    <Card className="relative overflow-hidden">
      <div className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-primary/10 blur-2xl" />
      <div className="bg-gradient-to-br from-primary to-emerald-600 p-5 text-primary-foreground sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-sm text-primary-foreground/80">
              <Wallet className="size-4" /> This week&apos;s payment
            </p>
            <p className="mt-1 text-4xl font-bold">{formatMoney(weeklyTarget)}</p>
            {currentWeek ? (
              <p className="mt-1 text-sm text-primary-foreground/80">
                Week {currentWeek.number} · {formatDate(currentWeek.startDate)} –{" "}
                {formatDate(currentWeek.endDate)}
              </p>
            ) : null}
          </div>
          <div className="rounded-2xl bg-white/10 p-3 backdrop-blur">
            <p className="text-xs text-primary-foreground/80">Account</p>
            <p className="font-mono text-sm font-bold tracking-wider">
              {state.settings.paymentAccount.accountNumber}
            </p>
            <p className="text-xs text-primary-foreground/80">{state.settings.paymentAccount.bank}</p>
          </div>
        </div>
      </div>

      <CardContent className="space-y-4 p-5 sm:p-6">
        {hasPendingReceipt ? (
          <div className="flex items-center gap-4 rounded-2xl border border-warning/30 bg-warning/10 p-4">
            <div className="flex size-11 items-center justify-center rounded-xl bg-warning/20 text-warning">
              <Clock3 className="size-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">Receipt pending review</p>
              <p className="text-xs text-muted-foreground">
                {member.name}, your {currentWeek ? `Week ${currentWeek.number}` : ""} transfer is
                being reviewed by the admin.
              </p>
            </div>
            <Badge variant="warning">Pending</Badge>
          </div>
        ) : currentWeek ? (
          <div className="space-y-3 rounded-2xl border p-4">
            <div className="grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Bank</p>
                <p className="font-semibold">{state.settings.paymentAccount.bank}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Account name</p>
                <p className="font-semibold">{state.settings.paymentAccount.accountName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Account number</p>
                <p className="font-mono font-bold tracking-wider">
                  {state.settings.paymentAccount.accountNumber}
                </p>
              </div>
            </div>
            {!isAdmin ? (
              <Button
                size="lg"
                className="w-full gap-2"
                onClick={() => setDialogWeek(currentWeek.id)}
              >
                <ArrowLeftRight className="size-4" /> I&apos;ve transferred · upload receipt
              </Button>
            ) : null}
          </div>
        ) : null}

        {isAdmin ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" className="gap-2" onClick={() => setMarkOpen(true)}>
              <HandCoins className="size-4" /> Mark a week as paid
            </Button>
            <p className="text-xs text-muted-foreground">
              Confirm each member once they&apos;ve paid below.
            </p>
          </div>
        ) : null}

        <WeekConfirm />

        <ReceiptUploadDialog
          open={dialogWeek !== null}
          onOpenChange={(o) => !o && setDialogWeek(null)}
          weekId={dialogWeek ?? ""}
          weekNumber={currentWeek?.number ?? 0}
          amount={currentWeek ? getWeeklyTarget(state, member.id, currentWeek) : 0}
          account={state.settings.paymentAccount}
        />
        <AdminMarkPaidDialog open={markOpen} onOpenChange={setMarkOpen} />
      </CardContent>
    </Card>
  );
}
