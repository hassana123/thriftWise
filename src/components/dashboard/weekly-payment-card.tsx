"use client";

import * as React from "react";
import { ArrowLeftRight, Check, Clock3, HandCoins, TriangleAlert, Wallet, X } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ReceiptUploadDialog } from "@/components/payments/receipt-upload-dialog";
import { CopyButton } from "@/components/copy-button";
import { useThrift } from "@/providers/thrift-provider";
import { useAuth } from "@/providers/auth-provider";
import { formatMoney, formatDate } from "@/lib/format";
import { getCurrentWeek, getWeekStatus } from "@/domain/calendar";
import {
  getFirstUnpaidWeek,
  getWeekPayment,
  getWeekSavings,
  getWeeklyTarget,
} from "@/domain/calculations";

export function WeeklyPaymentCard() {
  const { state } = useThrift();
  const { member } = useAuth();
  const [dialogWeekId, setDialogWeekId] = React.useState<string | null>(null);
  const [dialogAmount, setDialogAmount] = React.useState<number | null>(null);

  if (!state || !member) return null;

  const openReceiptDialog = (weekId: string, amount?: number) => {
    setDialogWeekId(weekId);
    setDialogAmount(amount ?? null);
  };

  const isAdmin = member.role === "admin";
  const currentWeek = getCurrentWeek(state.weeks);
  // Focus the card on the earliest week that still needs paying. A missed or
  // partially-covered past week must be settled before the current week's
  // contribution is requested — never skip ahead of an outstanding payment.
  const targetWeek = getFirstUnpaidWeek(state, member.id) ?? currentWeek;
  const isOverdue = Boolean(targetWeek && getWeekStatus(targetWeek) === "past");
  const weeklyTarget = targetWeek ? getWeeklyTarget(state, member.id, targetWeek) : 0;
  const currentIndex = currentWeek ? state.weeks.findIndex((w) => w.id === currentWeek.id) : -1;
  const nextWeek = currentIndex >= 0 ? state.weeks[currentIndex + 1] : undefined;
  const dialogWeek = dialogWeekId ? state.weeks.find((w) => w.id === dialogWeekId) : undefined;
  const currentPayment = targetWeek
    ? getWeekPayment(state.payments, member.id, targetWeek.id)
    : undefined;
  const nextWeekCovered = nextWeek ? getWeekSavings(state.savings, member.id, nextWeek.id) : 0;
  const nextWeekTarget = nextWeek ? getWeeklyTarget(state, member.id, nextWeek) : 0;
  const nextWeekFullyCovered = nextWeekTarget > 0 && nextWeekCovered >= nextWeekTarget;
  const hasPendingReceipt =
    currentPayment?.receiptStatus === "pending" || currentPayment?.status === "pending";
  const hasReceipt = Boolean(currentPayment?.receiptUrl) || Boolean(currentPayment?.receiptStatus);
  const targetSavings = targetWeek ? getWeekSavings(state.savings, member.id, targetWeek.id) : 0;
  const targetCovered = Boolean(targetWeek && weeklyTarget > 0 && targetSavings >= weeklyTarget);
  const isConfirmed = currentPayment?.status === "approved" && targetCovered;
  const isPartiallyPaid = Boolean(currentPayment?.status === "approved" && !targetCovered);
  // When an earlier week is still outstanding, let the member settle it and the
  // current week in a single transfer — one receipt covers both.
  const currentWeekTarget = currentWeek ? getWeeklyTarget(state, member.id, currentWeek) : 0;
  const currentWeekCovered = Boolean(
    currentWeek &&
      currentWeekTarget > 0 &&
      getWeekSavings(state.savings, member.id, currentWeek.id) >= currentWeekTarget
  );
  const canPayTogether = Boolean(
    isOverdue && targetWeek && currentWeek && currentWeek.id !== targetWeek.id && !currentWeekCovered
  );
  const combinedTarget = weeklyTarget + currentWeekTarget;

  return (
    <Card className="relative overflow-hidden">
      <div className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-primary/10 blur-2xl" />
      <div className="bg-gradient-to-br from-primary to-emerald-600 p-5 text-primary-foreground sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-sm text-primary-foreground/80">
              <Wallet className="size-4" />{" "}
              {isOverdue ? "Outstanding payment" : "This week's payment"}
            </p>
            <p className="mt-1 text-4xl font-bold">{formatMoney(weeklyTarget)}</p>
            {targetWeek ? (
              <p className="mt-1 text-sm text-primary-foreground/80">
                Week {targetWeek.number} · {formatDate(targetWeek.startDate)} –{" "}
                {formatDate(targetWeek.endDate)}
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
                {targetWeek ? `Week ${targetWeek.number}` : ""} transfer shortly.
              </p>
            </div>
            <Badge variant="warning">Pending</Badge>
          </div>
        ) : isConfirmed ? (
          <div className="space-y-3">
            <div className="flex items-center gap-4 rounded-2xl border border-success/30 bg-success/5 p-4">
              <div className="flex size-11 items-center justify-center rounded-xl bg-success/15 text-success">
                <Check className="size-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">Week {targetWeek?.number} confirmed</p>
                <p className="text-xs text-muted-foreground">
                  {formatMoney(currentPayment?.amount ?? weeklyTarget)} recorded for this week. One
                  receipt per week — you’re all set.
                </p>
              </div>
              <Badge variant="success">Paid</Badge>
            </div>
            {nextWeek ? (
              nextWeekFullyCovered ? (
                <div className="flex items-center gap-3 rounded-2xl border border-success/30 bg-success/5 p-4">
                  <div className="flex size-11 items-center justify-center rounded-xl bg-success/15 text-success">
                    <Check className="size-5" />
                  </div>
                  <p className="text-sm font-medium">
                    Week {nextWeek.number} is already fully covered in advance — you’re all set.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full gap-2"
                    onClick={() => openReceiptDialog(nextWeek.id)}
                  >
                    <ArrowLeftRight className="size-4" /> Pay for Week {nextWeek.number} in advance
                  </Button>
                  {nextWeekCovered > 0 ? (
                    <p className="text-center text-xs text-muted-foreground">
                      {formatMoney(nextWeekCovered)} of {formatMoney(nextWeekTarget)} already
                      covered for Week {nextWeek.number} — top up to cover more.
                    </p>
                  ) : null}
                </div>
              )
            ) : null}
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
              onClick={() => openReceiptDialog(targetWeek?.id ?? "")}
            >
              <ArrowLeftRight className="size-4" /> Re-upload receipt for Week {targetWeek?.number}
            </Button>
          </div>
        ) : isPartiallyPaid ? (
          <div className="space-y-3 rounded-2xl border border-warning/30 bg-warning/5 p-4">
            <div className="flex items-center gap-4">
              <div className="flex size-11 items-center justify-center rounded-xl bg-warning/15 text-warning">
                <HandCoins className="size-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">
                  Week {targetWeek?.number} is only partially covered
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatMoney(targetSavings)} of {formatMoney(weeklyTarget)} is in — top up the
                  remaining {formatMoney(Math.max(0, weeklyTarget - targetSavings))} to complete
                  it.
                </p>
              </div>
              <Badge variant="warning">Partial</Badge>
            </div>
            <Button
              size="lg"
              className="w-full gap-2"
              onClick={() => openReceiptDialog(targetWeek?.id ?? "")}
            >
              <ArrowLeftRight className="size-4" /> Top up Week {targetWeek?.number}
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
                Only one receipt per week is allowed for Week {targetWeek?.number}.
              </p>
            </div>
          </div>
        ) : targetWeek ? (
          <div className="space-y-3 rounded-2xl border p-4">
            {isOverdue ? (
              <div className="flex items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-destructive/15 text-destructive">
                  <TriangleAlert className="size-5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">Week {targetWeek.number} was missed</p>
                  <p className="text-xs text-muted-foreground">
                    Settle this outstanding week first — the current week will come up once it’s
                    covered.
                  </p>
                </div>
              </div>
            ) : null}
            {canPayTogether && currentWeek ? (
              <div className="space-y-2 rounded-2xl border border-primary/30 bg-primary/5 p-4">
                <p className="text-sm font-semibold">Pay both weeks at once</p>
                <p className="text-xs text-muted-foreground">
                  Cover Week {targetWeek.number} and Week {currentWeek.number} in a single
                  transfer —{" "}
                  <span className="font-semibold text-foreground">
                    {formatMoney(combinedTarget)} total
                  </span>
                  . One receipt settles both.
                </p>
                <Button
                  size="lg"
                  className="w-full gap-2"
                  onClick={() => openReceiptDialog(targetWeek.id, combinedTarget)}
                >
                  <ArrowLeftRight className="size-4" /> Pay {formatMoney(combinedTarget)} · upload
                  receipt
                </Button>
              </div>
            ) : null}
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
              onClick={() => openReceiptDialog(targetWeek.id)}
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
          open={dialogWeekId !== null}
          onOpenChange={(o) => {
            if (!o) {
              setDialogWeekId(null);
              setDialogAmount(null);
            }
          }}
          weekId={dialogWeek?.id ?? ""}
          weekNumber={dialogWeek?.number ?? 0}
          amount={dialogAmount ?? (dialogWeek ? getWeeklyTarget(state, member.id, dialogWeek) : 0)}
          account={state.settings.paymentAccount}
          currentWeekNumber={currentWeek?.number}
        />
      </CardContent>
    </Card>
  );
}
