"use client";

import * as React from "react";
import { Check, Clock3, HandCoins, ShieldCheck, X } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useThrift } from "@/providers/thrift-provider";
import { formatMoney, formatDate, initials } from "@/lib/format";
import { getWeeklyTarget } from "@/domain/calculations";

export function ConfirmPayments() {
  const { state, approvePayment, rejectPayment } = useThrift();
  const [confirmId, setConfirmId] = React.useState<string | null>(null);

  if (!state) return null;

  const pending = state.payments.filter((p) => p.receiptStatus === "pending");

  if (pending.length === 0) {
    return (
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4 text-primary" /> Confirm payments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 rounded-2xl bg-success/5 px-4 py-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-success/10 text-success">
              <Check className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">All receipts reviewed</p>
              <p className="text-xs text-muted-foreground">
                New uploads will appear here. Approving records the amount shown on the receipt.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="size-4 text-primary" /> Confirm payments
        </CardTitle>
        <Badge variant="warning">{pending.length} pending</Badge>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {pending.map((payment) => {
          const member = state.members.find((m) => m.id === payment.memberId);
          const week = state.weeks.find((w) => w.id === payment.weekId);
          const target = week
            ? getWeeklyTarget(state, payment.memberId, week)
            : payment.amount;
          const recordedAmount = payment.amount || target;
          const isConfirming = confirmId === payment.id;
          return (
            <div
              key={payment.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl border px-3 py-2.5"
            >
              <Avatar className="size-9">
                <AvatarFallback style={{ backgroundColor: member?.color }} className="text-white text-xs">
                  {initials(member?.name ?? "?")}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {member?.name} · Week {week?.number}
                </p>
                <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock3 className="size-3" /> Uploaded {formatDate(payment.createdAt, "MMM d")}
                  </span>
                  <span>
                    Receipt: <b className="text-foreground">{formatMoney(recordedAmount)}</b>
                  </span>
                  {recordedAmount !== target ? (
                    <span className="text-muted-foreground/70">(target {formatMoney(target)})</span>
                  ) : null}
                </p>
              </div>
              {isConfirming ? (
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    className="gap-1"
                    onClick={() => {
                      approvePayment(payment.memberId, payment.weekId);
                      setConfirmId(null);
                    }}
                  >
                    <Check className="size-3.5" /> Yes, approve
                  </Button>
                  <Button size="sm" variant="ghost" className="text-xs" onClick={() => setConfirmId(null)}>
                    Back
                  </Button>
                </div>
              ) : (
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    className="gap-1"
                    onClick={() => setConfirmId(payment.id)}
                    title="Approve — the receipt amount will be recorded and the week marked paid"
                  >
                    <HandCoins className="size-3.5" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1 text-destructive"
                    onClick={() =>
                      rejectPayment(payment.memberId, payment.weekId, "Receipt unclear, please re-upload")
                    }
                  >
                    <X className="size-3.5" /> Reject
                  </Button>
                </div>
              )}
            </div>
          );
        })}
        <p className="text-xs text-muted-foreground">
          Approving records the exact amount on the receipt and marks that week as paid.
        </p>
      </CardContent>
    </Card>
  );
}
