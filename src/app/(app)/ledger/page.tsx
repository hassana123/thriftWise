"use client";

import * as React from "react";
import { BookOpen, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, ShieldCheck } from "lucide-react";
import { addDays } from "date-fns";

import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useThrift } from "@/providers/thrift-provider";
import { useAuth } from "@/providers/auth-provider";
import { formatMoney, formatDate, initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getCurrentWeek, getWeekStatus, iso, parseDay } from "@/domain/calendar";
import {
  getFamilySavings,
  getMemberPlan,
  getSavingsOn,
  getWeekPayment,
  getWeekSavings,
  getWeeklyTarget,
} from "@/domain/calculations";
import { WhatsAppShareButton } from "@/components/dashboard/whatsapp-share-button";
import {
  buildLedger,
  LEDGER_STATUS_META,
  type LedgerStatus,
} from "@/domain/ledger";

const LEGEND_ORDER: LedgerStatus[] = ["paid", "partial", "pending", "review", "missed", "future"];
type ViewMode = "day" | "week" | "month";

export default function LedgerPage() {
  const { state } = useThrift();
  const { member } = useAuth();

  const [view, setView] = React.useState<ViewMode>("day");

  const currentWeekIndex = React.useMemo(() => {
    if (!state) return 0;
    const current = getCurrentWeek(state.weeks);
    return current ? state.weeks.findIndex((w) => w.id === current.id) : 0;
  }, [state]);

  const [weekIndex, setWeekIndex] = React.useState(currentWeekIndex);

  React.useEffect(() => {
    setWeekIndex(currentWeekIndex);
  }, [currentWeekIndex]);

  if (!state || !member) return null;

  const familySaved = getFamilySavings(state);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl">
            <BookOpen className="size-5 text-primary" /> Family Contribution Ledger
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everyone&apos;s contributions at a glance — like our paper notebook.
          </p>
          <p className="mt-0.5 text-xs font-medium text-muted-foreground">
            Total saved: <span className="font-semibold text-foreground">{formatMoney(familySaved)}</span>
          </p>
        </div>
        <WhatsAppShareButton />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border bg-muted/40 p-1">
          {(["day", "week", "month"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn(
                "rounded-lg px-3.5 py-1.5 text-xs font-bold capitalize transition-colors",
                view === v ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {v} view
            </button>
          ))}
        </div>

        {view !== "week" ? (
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-8 rounded-full"
              disabled={weekIndex <= 0}
              onClick={() => setWeekIndex((i) => Math.max(0, i - 1))}
              aria-label="Previous week"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-xs font-semibold text-muted-foreground">
              {state.weeks[weekIndex]
                ? `${formatDate(state.weeks[weekIndex].startDate)} – ${formatDate(state.weeks[weekIndex].endDate)}`
                : ""}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-8 rounded-full"
              disabled={weekIndex >= state.weeks.length - 1}
              onClick={() => setWeekIndex((i) => Math.min(state.weeks.length - 1, i + 1))}
              aria-label="Next week"
            >
              <ChevronRight className="size-4" />
            </Button>
            {currentWeekIndex !== weekIndex ? (
              <button
                type="button"
                onClick={() => setWeekIndex(currentWeekIndex)}
                className="rounded-full border px-2 py-1 text-[10px] font-bold text-primary transition-colors hover:bg-primary/5"
              >
                This week
              </button>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-1 text-[10px] font-bold text-warning">
                <Clock3 className="size-3" /> NOW
              </span>
            )}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        {LEGEND_ORDER.map((s) => {
          const meta = LEDGER_STATUS_META[s];
          return (
            <span key={s} className="flex items-center gap-1.5">
              <span className={cn("inline-flex size-4 items-center justify-center rounded border text-[10px] font-bold", meta.className)}>
                {meta.symbol}
              </span>
              {meta.label}
            </span>
          );
        })}
      </div>

      {view === "week" ? (
        <WeekMatrix state={state} memberId={member.id} />
      ) : view === "day" ? (
        <DayGrid state={state} memberId={member.id} weekIndex={weekIndex} />
      ) : (
        <MonthGrid state={state} memberId={member.id} />
      )}

      <p className="flex items-center gap-2 rounded-2xl border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
        <ShieldCheck className="size-4 shrink-0 text-primary" />
        Paid (✓) means the whole week is covered. Partially paid (🟡) means some days are covered but
        Mon–Fri isn&apos;t complete yet. Pending (◷) means it isn&apos;t due yet. Needs review (⚠)
        means a receipt is waiting for the admin. To mark or undo a week, use the “Mark weeks as
        paid” table on the Family page.
      </p>
    </div>
  );
}

function WeekMatrix({ state, memberId }: { state: NonNullable<ReturnType<typeof useThrift>["state"]>; memberId: string }) {
  const ledger = buildLedger(state);
  const currentWeek = getCurrentWeek(state.weeks);
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 min-w-[190px] border-b bg-card px-4 py-3 text-left text-xs font-semibold text-muted-foreground">
                  Member
                </th>
                {ledger.weeks.map((w) => {
                  const isCurrent = currentWeek?.id === w.id;
                  return (
                    <th
                      key={w.id}
                      className={cn(
                        "border-b px-2 py-3 text-center text-xs font-semibold",
                        isCurrent ? "text-primary" : "text-muted-foreground"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-flex h-7 min-w-7 items-center justify-center rounded-lg px-1",
                          isCurrent && "bg-primary/10"
                        )}
                      >
                        W{w.number}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {ledger.rows.map((row) => {
                const plan = getMemberPlan(state, row.member.id);
                const isMe = row.member.id === memberId;
                return (
                  <tr key={row.member.id} className={cn(isMe && "bg-primary/[0.04]")}>
                    <td
                      className={cn(
                        "sticky left-0 z-10 border-b bg-card px-4 py-2.5",
                        isMe && "bg-primary/[0.04]"
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <Avatar className="size-8">
                          <AvatarFallback
                            style={{ backgroundColor: row.member.color }}
                            className="text-white text-[10px]"
                          >
                            {initials(row.member.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {row.member.name}
                            {isMe ? (
                              <span className="ml-1 text-xs font-medium text-primary">(you)</span>
                            ) : null}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{plan?.label}</p>
                        </div>
                      </div>
                    </td>
                    {row.cells.map((cell, i) => {
                      const meta = LEDGER_STATUS_META[cell];
                      const week = ledger.weeks[i];
                      const isCurrent = currentWeek?.id === week.id;
                      const payment = getWeekPayment(state.payments, row.member.id, week.id);
                      const weekSaved = getWeekSavings(state.savings, row.member.id, week.id);
                      const weekTarget = getWeeklyTarget(state, row.member.id, week);
                      return (
                        <td
                          key={week.id}
                          className={cn(
                            "border-b px-2 py-2.5 text-center",
                            isCurrent && "bg-primary/[0.04]"
                          )}
                        >
                          <span
                            className={cn(
                              "inline-flex size-6 items-center justify-center rounded-full text-xs font-bold",
                              cell === "paid" && "bg-success/10",
                              (cell === "partial" || cell === "review") && "bg-warning/10",
                              cell === "missed" && "bg-destructive/10",
                              meta.className
                            )}
                            title={
                              cell === "paid"
                                ? `${meta.label} · ${formatMoney(weekSaved)}`
                                : cell === "partial"
                                  ? `${meta.label} · ${formatMoney(weekSaved)} / ${formatMoney(weekTarget)}`
                                  : cell === "review" && payment?.amount
                                    ? `${meta.label} · ${formatMoney(payment.amount)}`
                                    : meta.label
                            }
                          >
                            {meta.symbol}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function DayGrid({
  state,
  memberId,
  weekIndex,
}: {
  state: NonNullable<ReturnType<typeof useThrift>["state"]>;
  memberId: string;
  weekIndex: number;
}) {
  const members = state.members.filter((m) => m.status === "active");
  const workingDays = state.settings.workingDays;
  const week = state.weeks[weekIndex];
  if (!week) return null;
  const todayIso = iso(new Date());
  const weekStart = parseDay(week.startDate);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const status = getWeekStatus(week);

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold text-primary-foreground">
              Week {week.number}
            </span>
            <span className="text-xs font-semibold text-muted-foreground">
              {formatDate(week.startDate)} – {formatDate(week.endDate)}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">Day by day</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border-b px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                  Day
                </th>
                {members.map((m) => (
                  <th
                    key={m.id}
                    className={cn(
                      "border-b px-2 py-2 text-center text-xs font-semibold",
                      m.id === memberId ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    <span className="inline-flex flex-col items-center gap-1">
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
              {days.map((day) => {
                const dateStr = iso(day);
                const dow = day.getDay() === 0 ? 7 : day.getDay();
                const isToday = dateStr === todayIso;
                const isPast = dateStr < todayIso;
                const isWorking = workingDays.includes(dow);
                return (
                  <tr key={dateStr} className={cn(isToday && "bg-primary/[0.05]", !isWorking && "opacity-60")}>
                    <td
                      className={cn(
                        "whitespace-nowrap border-b px-3 py-1.5 text-xs font-semibold",
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
                      if (!isWorking) {
                        return (
                          <td key={m.id} className="border-b px-1 py-1 text-center">
                            <span className="text-[11px] font-medium text-muted-foreground/25">·</span>
                          </td>
                        );
                      }
                      const amount = getSavingsOn(state.savings, m.id, dateStr);
                      if (amount > 0) {
                        return (
                          <td key={m.id} className="border-b px-1 py-1 text-center">
                            <span
                              className={cn(
                                "inline-flex min-w-12 items-center justify-center rounded-md bg-success/10 px-1 py-0.5 text-[11px] font-bold tabular-nums text-success",
                                m.id === memberId && "ring-1 ring-primary/40"
                              )}
                            >
                              {formatMoney(amount)}
                            </span>
                          </td>
                        );
                      }
                      if (isPast) {
                        return (
                          <td key={m.id} className="border-b px-1 py-1 text-center">
                            <span
                              className={cn(
                                "inline-flex size-5 items-center justify-center rounded-full bg-success/10 text-success",
                                m.id === memberId && "ring-1 ring-primary/40"
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
                          <td key={m.id} className="border-b px-1 py-1 text-center">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full border border-dashed border-primary/40 px-1.5 py-0.5 text-[10px] font-bold text-primary",
                                m.id === memberId && "ring-1 ring-primary/40"
                              )}
                            >
                              Today
                            </span>
                          </td>
                        );
                      }
                      return (
                        <td key={m.id} className="border-b px-1 py-1 text-center">
                          <span className="text-[11px] font-medium text-muted-foreground/40">—</span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td className="px-3 pt-2 text-xs font-semibold text-muted-foreground">Week saved</td>
                {members.map((m) => {
                  const saved = getWeekSavings(state.savings, m.id, week.id);
                  const target = getWeeklyTarget(state, m.id, week);
                  return (
                    <td key={m.id} className="px-1 pt-2 text-center">
                      {status === "upcoming" && saved === 0 ? (
                        <span className="text-[10px] font-bold text-muted-foreground/60">
                          Not due yet
                        </span>
                      ) : (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold",
                            saved >= target && saved > 0
                              ? "bg-success/10 text-success"
                              : saved > 0
                                ? "bg-secondary/60 text-muted-foreground"
                                : "bg-secondary/60 text-muted-foreground/60",
                            m.id === memberId && "ring-1 ring-primary/40"
                          )}
                        >
                          {saved > 0 ? formatMoney(saved) : "—"}
                          <span className="font-medium text-muted-foreground/70">/ {formatMoney(target)}</span>
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function MonthGrid({
  state,
  memberId,
}: {
  state: NonNullable<ReturnType<typeof useThrift>["state"]>;
  memberId: string;
}) {
  const members = state.members.filter((m) => m.status === "active");

  const months = React.useMemo(() => {
    const map = new Map<string, { key: string; label: string; weeks: typeof state.weeks }>();
    for (const w of state.weeks) {
      const key = formatDate(w.startDate, "MMM yyyy");
      if (!map.has(key)) map.set(key, { key, label: key, weeks: [] });
      map.get(key)!.weeks.push(w);
    }
    return [...map.values()];
  }, [state]);

  const monthSaved = (memberId: string, weeks: typeof state.weeks) =>
    weeks.reduce((sum, w) => sum + getWeekSavings(state.savings, memberId, w.id), 0);
  const monthTarget = (memberId: string, weeks: typeof state.weeks) =>
    weeks.reduce((sum, w) => sum + getWeeklyTarget(state, memberId, w), 0);

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
          <span className="inline-flex items-center gap-1.5 text-sm font-bold">
            <CalendarDays className="size-4 text-primary" /> Monthly totals
          </span>
          <span className="text-xs text-muted-foreground">Saved vs target per member</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 min-w-[190px] border-b bg-card px-4 py-3 text-left text-xs font-semibold text-muted-foreground">
                  Member
                </th>
                {months.map((m) => (
                  <th key={m.key} className="border-b px-3 py-3 text-center text-xs font-semibold text-muted-foreground">
                    {m.label}
                  </th>
                ))}
                <th className="border-b px-3 py-3 text-center text-xs font-semibold text-primary">Total</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const isMe = m.id === memberId;
                const grand = months.reduce((sum, mo) => sum + monthSaved(m.id, mo.weeks), 0);
                return (
                  <tr key={m.id} className={cn(isMe && "bg-primary/[0.04]")}>
                    <td
                      className={cn(
                        "sticky left-0 z-10 border-b bg-card px-4 py-2.5",
                        isMe && "bg-primary/[0.04]"
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <Avatar className="size-8">
                          <AvatarFallback
                            style={{ backgroundColor: m.color }}
                            className="text-white text-[10px]"
                          >
                            {initials(m.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {m.name}
                            {isMe ? (
                              <span className="ml-1 text-xs font-medium text-primary">(you)</span>
                            ) : null}
                          </p>
                        </div>
                      </div>
                    </td>
                    {months.map((mo) => {
                      const saved = monthSaved(m.id, mo.weeks);
                      const target = monthTarget(m.id, mo.weeks);
                      const complete = saved >= target && target > 0;
                      return (
                        <td key={mo.key} className="border-b px-3 py-2.5 text-center">
                          <span
                            className={cn(
                              "inline-flex flex-col items-center",
                              complete && saved > 0 ? "text-success" : "text-muted-foreground"
                            )}
                          >
                            <span className="text-sm font-bold tabular-nums">
                              {saved > 0 ? formatMoney(saved) : "—"}
                            </span>
                            <span className="text-[10px] font-medium text-muted-foreground/60">
                              {formatMoney(target)} due
                            </span>
                          </span>
                        </td>
                      );
                    })}
                    <td className="border-b px-3 py-2.5 text-center">
                      <span className="text-sm font-bold tabular-nums text-primary">
                        {formatMoney(grand)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td className="sticky left-0 z-10 bg-card px-4 py-2.5 text-xs font-semibold text-muted-foreground">
                  Family total
                </td>
                {months.map((mo) => (
                  <td key={mo.key} className="px-3 py-2.5 text-center text-sm font-bold tabular-nums text-foreground">
                    {formatMoney(
                      members.reduce((sum, m) => sum + monthSaved(m.id, mo.weeks), 0)
                    )}
                  </td>
                ))}
                <td className="px-3 py-2.5 text-center text-sm font-bold tabular-nums text-primary">
                  {formatMoney(
                    months.reduce(
                      (sum, mo) => sum + members.reduce((s, m) => s + monthSaved(m.id, mo.weeks), 0),
                      0
                    )
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
