"use client";

import * as React from "react";
import { ArrowLeftRight, Check, Clock3, HandCoins, Wallet, X } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ReceiptUploadDialog } from "@/components/payments/receipt-upload-dialog";
import { CopyButton } from "@/components/copy-button";
import { useThrift } from "@/providers/thrift-provider";
import { useAuth } from "@/providers/auth-provider";
import { formatMoney, formatDate } from "@/lib/format";
import { getCurrentWeek } from "@/domain/calendar";
import { getWeekPayment, getWeeklyTarget } from "@/domain/calculations";

export function WeeklyPaymentCard() {
  const { state } = useThrift();
  const { member } = useAuth();
  const [dialogWeek, setDialogWeek] = React.useState<string | null>(null);

  if (!state || !member) return null;

  const isAdmin = member.role === "admin";
  const currentWeek = getCurrentWeek(state.weeks);
  const weeklyTarget = currentWeek ? getWeeklyTarget(state, member.id, currentWeek) : 0;
  const currentPayment = currentWeek
    ? getWeekPayment(state.payments, member.id, currentWeek.id)
    : undefined;
  const hasPendingReceipt =
    currentPayment?.receiptStatus === "pending" || currentPayment?.status === "pending";
  const hasReceipt = Boolean(currentPayment?.receiptUrl) || Boolean(currentPayment?.receiptStatus);
  const isConfirmed = currentPayment?.status === "approved";

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
            <div className="flex items-center gap-1">
              <span className="font-mono text-sm font-bold tracking-wider">
                {state.settings.paymentAccount.accountNumber}
              </span>
              <CopyButton
                value={state.settings.paymentAccount.accountNumber}
                className="text-primary-foreground/70 hover:text-white"
              />
            </div>
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
                {member.name}, some receipt details didn’t fully match — the admin will confirm your{" "}
                {currentWeek ? `Week ${currentWeek.number}` : ""} transfer shortly.
              </p>
            </div>
            <Badge variant="warning">Pending</Badge>
          </div>
        ) : isConfirmed ? (
          <div className="flex items-center gap-4 rounded-2xl border border-success/30 bg-success/5 p-4">
            <div className="flex size-11 items-center justify-center rounded-xl bg-success/15 text-success">
              <Check className="size-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">Week {currentWeek?.number} confirmed</p>
              <p className="text-xs text-muted-foreground">
                {formatMoney(currentPayment?.amount ?? weeklyTarget)} recorded for this week. One
                receipt per week — you’re all set.
              </p>
            </div>
            <Badge variant="success">Paid</Badge>
          </div>
        ) : currentPayment?.receiptStatus === "rejected" ? (
          <div className="space-y-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
            <div className="flex items-center gap-4">
              <div className="flex size-11 items-center justify-center rounded-xl bg-destructive/15 text-destructive">
                <X className="size-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">Receipt was not accepted</p>
                <p className="text-xs text-muted-foreground">
                  {currentPayment.adminNote ??
                    "The admin couldn’t verify this receipt. Please re-upload a clearer one."}
                </p>
              </div>
              <Badge variant="destructive">Rejected</Badge>
            </div>
            <Button
              size="lg"
              className="w-full gap-2"
              onClick={() => setDialogWeek(currentWeek?.id ?? "")}
            >
              <ArrowLeftRight className="size-4" /> Re-upload receipt for Week {currentWeek?.number}
            </Button>
          </div>
        ) : hasReceipt ? (
          <div className="flex items-center gap-4 rounded-2xl border bg-muted/40 p-4">
            <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <HandCoins className="size-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">Receipt already uploaded</p>
              <p className="text-xs text-muted-foreground">
                Only one receipt per week is allowed for Week {currentWeek?.number}.
              </p>
            </div>
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
                <div className="flex items-center gap-1">
                  <span className="font-mono font-bold tracking-wider">
                    {state.settings.paymentAccount.accountNumber}
                  </span>
                  <CopyButton value={state.settings.paymentAccount.accountNumber} />
                </div>
              </div>
            </div>
            <Button
              size="lg"
              className="w-full gap-2"
              onClick={() => setDialogWeek(currentWeek.id)}
            >
              <ArrowLeftRight className="size-4" /> I&apos;ve transferred · upload receipt
            </Button>
          </div>
        ) : null}

        {isAdmin ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs text-muted-foreground">
              Confirm each member once they&apos;ve uploaded a receipt below.
            </p>
          </div>
        ) : null}

        <ReceiptUploadDialog
          open={dialogWeek !== null}
          onOpenChange={(o) => !o && setDialogWeek(null)}
          weekId={dialogWeek ?? ""}
          weekNumber={currentWeek?.number ?? 0}
          amount={currentWeek ? getWeeklyTarget(state, member.id, currentWeek) : 0}
          account={state.settings.paymentAccount}
        />
      </CardContent>
    </Card>
  );
}
