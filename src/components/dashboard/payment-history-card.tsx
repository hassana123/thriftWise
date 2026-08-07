"use client";

import * as React from "react";
import { CheckCircle2, Clock3, XCircle, ArrowLeftRight } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useThrift } from "@/providers/thrift-provider";
import { useAuth } from "@/providers/auth-provider";
import { formatMoney, formatDate } from "@/lib/format";
import { getWeekPayment, getWeeklyTarget } from "@/domain/calculations";
import { getCurrentWeek } from "@/domain/calendar";
import type { PaymentStatus } from "@/domain/types";

export function PaymentHistoryCard() {
  const { state } = useThrift();
  const { member } = useAuth();

  if (!state || !member) return null;

  const currentWeek = getCurrentWeek(state.weeks);
  const history = state.weeks
    .filter((w) => w.number < (currentWeek?.number ?? 99))
    .slice()
    .reverse()
    .map((week) => {
      const payment = getWeekPayment(state.payments, member.id, week.id);
      return {
        week,
        payment,
        amount: payment?.amount ?? getWeeklyTarget(state, member.id, week),
      };
    });

  if (history.length === 0) return null;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <ArrowLeftRight className="size-4 text-primary" /> Payment history
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {history.map(({ week, payment, amount }) => {
          const status: PaymentStatus =
            payment?.status ??
            (week.endDate < new Date().toISOString().slice(0, 10) ? "overdue" : "pending");
          return (
            <div key={week.id} className="flex items-center gap-3 rounded-xl border p-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary font-bold">
                {week.number}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Week {week.number}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(week.startDate)} – {formatDate(week.endDate)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold">{formatMoney(amount)}</p>
                <PaymentStatusBadge status={status} />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const config: Record<
    PaymentStatus,
    { label: string; variant: "success" | "warning" | "destructive" | "muted"; icon: React.ComponentType<{ className?: string }> }
  > = {
    approved: { label: "Paid", variant: "success", icon: CheckCircle2 },
    pending: { label: "Pending", variant: "warning", icon: Clock3 },
    rejected: { label: "Rejected", variant: "destructive", icon: XCircle },
    overdue: { label: "Overdue", variant: "destructive", icon: Clock3 },
  };
  const c = config[status];
  return (
    <Badge variant={c.variant} className="gap-1">
      <c.icon className="size-3" /> {c.label}
    </Badge>
  );
}
