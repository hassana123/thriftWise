"use client";

import * as React from "react";
import { Check, Clock, Coins, PiggyBank, TrendingUp, Wallet } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ContributionCalendar } from "@/components/dashboard/contribution-calendar";
import { MonthlyTrend } from "@/components/dashboard/monthly-trend";
import { useThrift } from "@/providers/thrift-provider";
import { formatMoney, formatMoneyCompact, formatDate, initials } from "@/lib/format";
import {
  getCollectionRate,
  getFamilySavings,
  getFamilyTransferred,
  getFamilyRanking,
  getTotalSaved,
  getWeekPayment,
} from "@/domain/calculations";
import { getCurrentWeek, getWeekStatus } from "@/domain/calendar";
import type { PaymentStatus, ThriftState } from "@/domain/types";

export default function AnalyticsPage() {
  const { state } = useThrift();

  if (!state) return null;

  const familySavings = getFamilySavings(state);
  const familyTransferred = getFamilyTransferred(state);
  const collectionRate = getCollectionRate(state);
  const ranking = getFamilyRanking(state);
  const currentWeek = getCurrentWeek(state.weeks);
  const elapsedWeeks = state.weeks.filter((w) => getWeekStatus(w) !== "upcoming").length;
  const paidWeeks = state.payments.filter((p) => p.status === "approved").length;
  const topSaved = ranking[0] ? getTotalSaved(state, ranking[0].id) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Simple numbers for the whole family — no jargon.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={PiggyBank} label="Total family savings" value={formatMoney(familySavings)} hint="Combined savings of every member" />
        <KpiCard icon={Wallet} label="Transferred to date" value={formatMoney(familyTransferred)} hint="Set aside for the vacation fund" />
        <KpiCard icon={Check} label="Collection rate" value={`${collectionRate}%`} hint="Of the money due so far, this was paid" />
        <KpiCard icon={TrendingUp} label="Weeks settled" value={`${paidWeeks}/${elapsedWeeks}`} hint="Approved weeks out of weeks so far" />
      </div>

      {currentWeek ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">This week (Week {currentWeek.number})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {ranking.map((m) => {
              const payment = getWeekPayment(state.payments, m.id, currentWeek.id);
              const paid = payment?.status === "approved";
              const pending = payment?.status === "pending";
              return (
                <div key={m.id} className="flex items-center justify-between rounded-2xl border px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <Avatar className="size-8">
                      <AvatarFallback style={{ backgroundColor: m.color }} className="text-white text-xs">
                        {initials(m.name)}
                      </AvatarFallback>
                    </Avatar>
                    <p className="text-sm font-medium">{m.name}</p>
                  </div>
                  {paid ? (
                    <Badge variant="success" className="gap-1">
                      <Check className="size-3.5" /> Paid
                    </Badge>
                  ) : pending ? (
                    <Badge variant="warning" className="gap-1">
                      <Clock className="size-3.5" /> Needs review
                    </Badge>
                  ) : (
                    <Badge variant="outline">No submission yet</Badge>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Member ranking</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {ranking.map((m, i) => {
              const saved = getTotalSaved(state, m.id);
              const pct = topSaved > 0 ? Math.round((saved / topSaved) * 100) : 0;
              return (
                <div key={m.id} className="flex items-center gap-3">
                  <span className={`w-4 text-center text-sm font-bold ${i === 0 ? "text-warning" : "text-muted-foreground"}`}>
                    {i + 1}
                  </span>
                  <Avatar className="size-8">
                    <AvatarFallback style={{ backgroundColor: m.color }} className="text-white text-xs">
                      {initials(m.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{m.name}</p>
                      <p className="text-sm font-semibold">{formatMoneyCompact(saved)}</p>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contribution calendar</CardTitle>
          </CardHeader>
          <CardContent>
            <ContributionCalendar />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Monthly trend</CardTitle>
        </CardHeader>
        <CardContent>
          <MonthlyTrend scope="family" />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <PaymentHistory state={state} />
        <RecentActivity />
      </div>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-soft">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-xl font-bold tracking-tight">{value}</p>
        </div>
        <div className="flex size-9 items-center justify-center rounded-xl bg-muted text-primary">
          <Icon className="size-[18px]" />
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function PaymentHistory({ state }: { state: ThriftState }) {
  const payments = [...state.payments].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10);
  const weekOf = (weekId: string) => state.weeks.find((w) => w.id === weekId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Wallet className="size-4 text-primary" /> Recent payments
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {payments.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No payments recorded yet.</p>
        ) : (
          payments.map((p) => {
            const member = state.members.find((m) => m.id === p.memberId);
            const week = weekOf(p.weekId);
            return (
              <div key={p.id} className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-muted/60">
                <Avatar className="size-8">
                  <AvatarFallback style={{ backgroundColor: member?.color }} className="text-white text-xs">
                    {initials(member?.name ?? "?")}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {member?.name} · Week {week?.number}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDate(p.createdAt, "MMM d, h:mm a")}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">{formatMoney(p.amount ?? 0)}</p>
                  <PaymentStatusBadge status={p.status} />
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const config: Record<PaymentStatus, { label: string; variant: "success" | "warning" | "destructive" | "muted" }> = {
    approved: { label: "Paid", variant: "success" },
    pending: { label: "Pending", variant: "warning" },
    rejected: { label: "Rejected", variant: "destructive" },
    overdue: { label: "Overdue", variant: "destructive" },
  };
  const c = config[status];
  return <Badge variant={c.variant}>{c.label}</Badge>;
}

function RecentActivity() {
  const { state } = useThrift();
  if (!state) return null;

  const activities = state.activities.slice(0, 8);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Coins className="size-4 text-primary" /> Recent activity
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {activities.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          activities.map((a) => (
            <div key={a.id} className="flex items-start gap-3 rounded-xl p-2 transition-colors hover:bg-muted/60">
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Coins className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{a.message}</p>
                <p className="text-xs text-muted-foreground">{formatDate(a.createdAt, "MMM d, h:mm a")}</p>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
