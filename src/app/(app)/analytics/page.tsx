"use client";

import * as React from "react";
import { Check, Clock, PiggyBank, TrendingUp, Wallet } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useThrift } from "@/providers/thrift-provider";
import { formatMoney, formatMoneyCompact, initials } from "@/lib/format";
import {
  getCollectionRate,
  getFamilySavings,
  getFamilyTransferred,
  getFamilyRanking,
  getTotalSaved,
  getWeekPayment,
} from "@/domain/calculations";
import { getCurrentWeek, getWeekStatus } from "@/domain/calendar";

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
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Family overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Simple numbers for the whole family — no charts, no jargon.
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
