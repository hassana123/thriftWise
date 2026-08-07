"use client";

import * as React from "react";
import Link from "next/link";
import { addDays } from "date-fns";
import { ArrowUpRight, BookOpen, CalendarDays, Check, CircleDashed, Clock3 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useThrift } from "@/providers/thrift-provider";
import { useAuth } from "@/providers/auth-provider";
import { formatMoney, formatDate, initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getCurrentWeek, iso, parseDay } from "@/domain/calendar";
import { getSavingsOn, getWeekPayment } from "@/domain/calculations";
import type { Member, ThriftSettings } from "@/domain/types";

// A member who is signed up for 7 days contributes Mon–Sun; everyone else
// follows the group's contribution days.
function memberWorkDays(member: Member, settings: ThriftSettings): number[] {
  if (member.daysPerWeek === 7) return [1, 2, 3, 4, 5, 6, 7];
  return settings.workingDays;
}

export function LedgerPreview() {
  const { state } = useThrift();
  const { member } = useAuth();

  const totalSaved = React.useMemo(
    () =>
      state
        ? state.payments
            .filter((p) => p.status === "approved")
            .reduce((sum, p) => sum + (p.amount ?? 0), 0)
        : 0,
    [state]
  );

  if (!state || !member) return null;

  const members = state.members.filter((m) => m.status === "active");
  const currentWeek = getCurrentWeek(state.weeks);
  const todayIso = iso(new Date());
  const weekStart = currentWeek ? parseDay(currentWeek.startDate) : null;
  const weekDays = weekStart
    ? Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
    : [];

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center justify-between space-y-0 px-4 py-3 sm:px-5">
        <CardTitle className="flex items-center gap-2 text-base">
          <BookOpen className="size-4 text-primary" /> Family ledger
        </CardTitle>
        <Button variant="ghost" size="sm" asChild className="text-primary">
          <Link href="/ledger">
            Full ledger <ArrowUpRight className="size-3.5" />
          </Link>
        </Button>
      </CardHeader>

      <CardContent className="px-4 pb-4 sm:px-5">
        {!currentWeek ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed py-8 text-center">
            <CalendarDays className="size-6 text-muted-foreground/50" />
            <p className="text-sm font-medium">No active week right now</p>
            <p className="text-xs text-muted-foreground">
              The current week&apos;s days will appear here once it starts.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold text-primary-foreground">
                  Week {currentWeek.number}
                </span>
                <span className="text-xs font-semibold text-muted-foreground">
                  {formatDate(currentWeek.startDate)} – {formatDate(currentWeek.endDate)}
                </span>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-1 text-[10px] font-bold text-warning">
                <Clock3 className="size-3" /> NOW
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="pb-1.5 pr-2 text-left text-xs font-semibold text-muted-foreground">
                      Day
                    </th>
                    {members.map((m) => (
                      <th
                        key={m.id}
                        className={cn(
                          "pb-1.5 text-center text-xs font-semibold",
                          m.id === member.id ? "text-primary" : "text-muted-foreground"
                        )}
                      >
                        <span className="inline-flex flex-col items-center gap-0.5">
                          <Avatar className="size-6">
                            <AvatarFallback
                              style={{ backgroundColor: m.color }}
                              className="text-white text-[9px]"
                            >
                              {initials(m.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="max-w-[56px] truncate text-[10px] font-medium">
                            {m.name.split(" ")[0]}
                          </span>
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {weekDays.map((day) => {
                    const dateStr = iso(day);
                    const dow = day.getDay() === 0 ? 7 : day.getDay();
                    const isToday = dateStr === todayIso;
                    const isPast = dateStr < todayIso;
                    return (
                      <tr key={dateStr} className={cn(isToday && "bg-primary/[0.05]")}>
                        <td
                          className={cn(
                            "whitespace-nowrap py-1.5 pr-2 text-xs font-semibold",
                            isToday ? "text-primary" : "text-muted-foreground"
                          )}
                        >
                          {formatDate(dateStr, "EEE d")}
                          {isToday ? (
                            <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary">
                              today
                            </span>
                          ) : null}
                        </td>
                        {members.map((m) => {
                          const workDays = memberWorkDays(m, state.settings);
                          if (!workDays.includes(dow)) {
                            return (
                              <td key={m.id} className="px-1 py-1 text-center">
                                <span className="text-[11px] font-medium text-muted-foreground/25">
                                  ·
                                </span>
                              </td>
                            );
                          }
                          const amount = getSavingsOn(state.savings, m.id, dateStr);
                          if (amount > 0) {
                            return (
                              <td key={m.id} className="px-1 py-1 text-center">
                                <span
                                  className={cn(
                                    "inline-flex min-w-12 items-center justify-center rounded-md bg-success/10 px-1 py-0.5 text-[11px] font-bold tabular-nums text-success",
                                    m.id === member.id && "ring-1 ring-primary/40"
                                  )}
                                >
                                  <Check className="mr-0.5 size-2.5" strokeWidth={3} />
                                  {formatMoney(amount)}
                                </span>
                              </td>
                            );
                          }
                          if (isPast) {
                            return (
                              <td key={m.id} className="px-1 py-1 text-center">
                                <span
                                  className={cn(
                                    "inline-flex size-5 items-center justify-center rounded-full bg-success/10 text-success",
                                    m.id === member.id && "ring-1 ring-primary/40"
                                  )}
                                  title="Day has passed — counted as done"
                                >
                                  <Check className="size-3" strokeWidth={3} />
                                </span>
                              </td>
                            );
                          }
                          if (isToday) {
                            return (
                              <td key={m.id} className="px-1 py-1 text-center">
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1 rounded-full border border-dashed border-primary/40 px-1.5 py-0.5 text-[10px] font-bold text-primary",
                                    m.id === member.id && "ring-1 ring-primary/40"
                                  )}
                                >
                                  Today
                                </span>
                              </td>
                            );
                          }
                          return (
                            <td key={m.id} className="px-1 py-1 text-center">
                              <span className="text-[11px] font-medium text-muted-foreground/40">
                                —
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="border-t pt-2 pr-2 text-xs font-semibold text-muted-foreground">
                      Week
                    </td>
                    {members.map((m) => {
                      const payment = getWeekPayment(state.payments, m.id, currentWeek.id);
                      return (
                        <td key={m.id} className="border-t pt-2 text-center">
                          <WeekStatus
                            status={payment?.status}
                            amount={payment?.amount}
                            isMe={m.id === member.id}
                          />
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>

            <p className="mt-3 flex items-center gap-2 rounded-xl bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
              <CircleDashed className="size-3.5 shrink-0" />
              Each past day counts as done. A week is only marked{" "}
              <span className="font-semibold text-success">Paid</span> once the receipt is uploaded
              and confirmed.
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t pt-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="inline-flex size-3.5 items-center justify-center rounded-full bg-success/10 text-[9px] font-bold text-success">
                  <Check className="size-2" strokeWidth={3} />
                </span>
                Passed / saved
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-flex size-3.5 items-center justify-center rounded-full border border-primary/40 text-[9px] font-bold text-primary">
                  •
                </span>
                Today
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-flex size-3.5 items-center justify-center rounded-full text-muted-foreground/50">
                  <CircleDashed className="size-3" />
                </span>
                Rest / upcoming
              </span>
              <span className="ml-auto font-medium text-foreground">
                Confirmed <span className="text-primary">{formatMoney(totalSaved)}</span>
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function WeekStatus({
  status,
  amount,
  isMe,
}: {
  status?: "pending" | "approved" | "rejected" | "overdue";
  amount?: number;
  isMe: boolean;
}) {
  if (status === "approved") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-bold text-success",
          isMe && "ring-1 ring-primary/40"
        )}
      >
        <Check className="size-2.5" strokeWidth={3} /> Paid
        {amount ? <span className="tabular-nums text-success/80">· {formatMoney(amount)}</span> : null}
      </span>
    );
  }
  if (status === "pending" || status === "rejected") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-bold text-warning",
          isMe && "ring-1 ring-primary/40"
        )}
      >
        <Clock3 className="size-2.5" /> Review
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-secondary/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground",
        isMe && "ring-1 ring-primary/40"
      )}
    >
      <CircleDashed className="size-2.5" /> Pending
    </span>
  );
}
