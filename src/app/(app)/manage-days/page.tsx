"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  MinusCircle,
  PlusCircle,
  RotateCcw,
  ShieldCheck,
  X,
} from "lucide-react";
import { format } from "date-fns";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useThrift } from "@/providers/thrift-provider";
import { useAuth } from "@/providers/auth-provider";
import { formatMoney, formatDate, initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  getPlanForWeek,
  getSavingsOn,
  getWeekSavings,
  getWeeklyTarget,
} from "@/domain/calculations";
import { getCurrentWeek, parseDay } from "@/domain/calendar";

export default function ManageDaysPage() {
  const { state, markDaysPaid, unmarkDays } = useThrift();
  const { member: me } = useAuth();
  const [selectedId, setSelectedId] = React.useState<string>("");
  const [pending, setPending] = React.useState<Map<string, boolean>>(new Map());
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);

  const currentWeekIndex = React.useMemo(() => {
    if (!state) return 0;
    const current = getCurrentWeek(state.weeks);
    return current ? state.weeks.findIndex((w) => w.id === current.id) : 0;
  }, [state]);

  const [weekIndex, setWeekIndex] = React.useState(currentWeekIndex);

  React.useEffect(() => {
    if (!state) return;
    setSelectedId((prev) =>
      state.members.some((m) => m.id === prev) ? prev : (state.members[0]?.id ?? "")
    );
  }, [state]);

  React.useEffect(() => {
    setWeekIndex(currentWeekIndex);
  }, [currentWeekIndex]);

  if (!state || !me) return null;

  if (me.role !== "admin") {
    return (
      <Card>
        <CardContent className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
          <ShieldCheck className="size-4 text-primary" /> Only admins can edit the day-by-day ledger.
        </CardContent>
      </Card>
    );
  }

  const member = state.members.find((m) => m.id === selectedId) ?? null;
  const week = state.weeks[weekIndex] ?? state.weeks[0] ?? null;

  const coveredDates = new Set(
    member
      ? state.savings.filter((s) => s.memberId === member.id).map((s) => s.date)
      : []
  );

  const weekForDate = (date: string) => state.weeks.find((w) => w.days.some((d) => d.date === date));
  const dailyFor = (date: string) => {
    if (!member) return 0;
    const w = weekForDate(date);
    return w ? getPlanForWeek(state, member.id, w).dailyAmount : 0;
  };
  const savedOn = (date: string) => (member ? getSavingsOn(state.savings, member.id, date) : 0);

  const desiredMarked = (date: string) =>
    pending.has(date) ? pending.get(date) === true : coveredDates.has(date);
  const hasPending = (date: string) =>
    pending.has(date) && pending.get(date) !== coveredDates.has(date);

  const toggleDay = (date: string) => {
    const current = coveredDates.has(date);
    const desired = pending.has(date) ? pending.get(date) === true : current;
    const next = !desired;
    const nextPending = new Map(pending);
    if (next === current) nextPending.delete(date);
    else nextPending.set(date, next);
    setPending(nextPending);
  };

  const markAllInWeek = () => {
    if (!week) return;
    const nextPending = new Map(pending);
    for (const d of week.days) {
      if (coveredDates.has(d.date)) nextPending.delete(d.date);
      else nextPending.set(d.date, true);
    }
    setPending(nextPending);
  };

  const unmarkAllInWeek = () => {
    if (!week) return;
    const nextPending = new Map(pending);
    for (const d of week.days) {
      if (coveredDates.has(d.date)) nextPending.set(d.date, false);
      else nextPending.delete(d.date);
    }
    setPending(nextPending);
  };

  const toMark = [...pending.entries()]
    .filter(([date, desired]) => desired === true && !coveredDates.has(date))
    .map(([date]) => date);
  const toUnmark = [...pending.entries()]
    .filter(([date, desired]) => desired === false && coveredDates.has(date))
    .map(([date]) => date);
  const toMarkAmount = toMark.reduce((sum, d) => sum + dailyFor(d), 0);
  const toUnmarkAmount = toUnmark.reduce((sum, d) => sum + savedOn(d), 0);

  const applyChanges = () => {
    if (!member) return;
    const parts: string[] = [];
    if (toMark.length > 0) {
      markDaysPaid(member.id, toMark);
      parts.push(`${toMark.length} day${toMark.length === 1 ? "" : "s"} marked`);
    }
    if (toUnmark.length > 0) {
      unmarkDays(member.id, toUnmark);
      parts.push(`${toUnmark.length} day${toUnmark.length === 1 ? "" : "s"} unmarked`);
    }
    setPending(new Map());
    if (parts.length > 0) {
      const weekLabel = week ? `Week ${week.number}` : "";
      setSuccessMsg(`${parts.join(" and ")} for ${member.name}${weekLabel ? ` in ${weekLabel}` : ""}.`);
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  };

  const saved = week ? getWeekSavings(state.savings, member?.id ?? "", week.id) : 0;
  const target = week && member ? getWeeklyTarget(state, member.id, week) : 0;
  const complete = target > 0 && saved >= target;
  const weekCovered = week ? week.days.filter((d) => coveredDates.has(d.date)).length : 0;
  const weekChanged = week ? week.days.filter((d) => hasPending(d.date)).length > 0 : false;
  const hasChanges = toMark.length > 0 || toUnmark.length > 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl">
            <ClipboardCheck className="size-5 text-primary" /> Manage days
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tap a day to mark or unmark it, then apply your changes.
          </p>
        </div>
        {member ? (
          <div className="flex items-center gap-2">
            <Avatar className="size-8">
              <AvatarFallback style={{ backgroundColor: member.color }} className="text-white text-[10px]">
                {initials(member.name)}
              </AvatarFallback>
            </Avatar>
            <Select value={member.id} onValueChange={(v) => { setSelectedId(v); setPending(new Map()); }}>
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {state.members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      {week && member ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-muted/40 px-3 py-2">
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
              <span className="text-sm font-bold">
                Week {week.number}
                {currentWeekIndex === weekIndex ? (
                  <span className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-bold text-warning">
                    <Clock3 className="size-3" /> NOW
                  </span>
                ) : null}
              </span>
              <span className="hidden text-xs font-medium text-muted-foreground sm:inline">
                {formatDate(week.startDate, "MMM d")} – {formatDate(week.endDate, "MMM d")}
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
                  className="ml-1 rounded-full border px-2 py-1 text-[10px] font-bold text-primary transition-colors hover:bg-primary/5"
                >
                  This week
                </button>
              ) : null}
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2 text-[11px] font-medium"
                onClick={markAllInWeek}
                disabled={week.days.every((d) => coveredDates.has(d.date))}
              >
                <Check className="size-3" /> Mark all
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2 text-[11px] font-medium text-muted-foreground hover:text-destructive"
                onClick={unmarkAllInWeek}
                disabled={weekCovered === 0}
              >
                <X className="size-3" /> Unmark all
              </Button>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold",
                  complete && saved > 0
                    ? "bg-success/10 text-success"
                    : "bg-secondary/60 text-muted-foreground"
                )}
              >
                {formatMoney(saved)} / {formatMoney(target)}
                {complete ? <Check className="size-3" strokeWidth={3} /> : null}
              </span>
            </div>
          </div>

          <Card className={cn("overflow-hidden", weekChanged && "ring-2 ring-primary/30")}>
            <CardContent className="space-y-3 p-4">
              <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-10">
                {week.days.map((d) => {
                  const marked = desiredMarked(d.date);
                  const pendingChange = hasPending(d.date);
                  const marking = pending.get(d.date) === true;
                  const unmarking = pending.get(d.date) === false;
                  const day = parseDay(d.date);
                  const amount = marked ? savedOn(d.date) : dailyFor(d.date);
                  return (
                    <button
                      key={d.date}
                      type="button"
                      onClick={() => toggleDay(d.date)}
                      className={cn(
                        "relative flex flex-col items-center rounded-xl border px-1 py-1.5 transition-all",
                        marked
                          ? "border-success/40 bg-success/10 text-success"
                          : "border-border text-foreground hover:bg-muted",
                        pendingChange && marking && "border-primary bg-primary/10 ring-2 ring-primary/40",
                        pendingChange && unmarking && "border-destructive bg-destructive/10 ring-2 ring-destructive/40",
                        unmarking && "opacity-80"
                      )}
                      title={`${format(day, "EEEE, MMM d")} · ${formatMoney(amount)} — tap to ${
                        marked ? "unmark" : "mark"
                      }`}
                    >
                      <span className="text-[10px] font-medium opacity-70">{format(day, "EEE")}</span>
                      <span className="text-xs font-bold leading-tight">{format(day, "d")}</span>
                      {marked ? (
                        <span className="mt-0.5 flex items-center gap-0.5 text-[9px] font-bold tabular-nums">
                          {unmarking ? <X className="size-2.5" strokeWidth={3} /> : <Check className="size-2.5" strokeWidth={3} />}
                          {formatMoney(amount)}
                        </span>
                      ) : (
                        <span className="mt-0.5 text-[9px] font-bold tabular-nums opacity-60">
                          {formatMoney(amount)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="size-4 shrink-0 text-primary" />
                Green = marked as paid. Tap a day to toggle it — changed days get a ring until you
                apply. Weekends are never counted.
              </p>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            {state.weeks.length === 0
              ? "No weeks generated yet."
              : "No members yet — add members on the Family page first."}
          </CardContent>
        </Card>
      )}

      <div className="sticky bottom-20 lg:bottom-4">
        <AnimatePresence>
          {successMsg ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-3 flex items-center gap-3 rounded-2xl border border-success/30 bg-success/5 px-4 py-3"
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-success/15">
                <Check className="size-4 text-success" />
              </div>
              <p className="text-sm font-medium text-foreground">{successMsg}</p>
            </motion.div>
          ) : null}
        </AnimatePresence>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card/95 p-3 shadow-lg backdrop-blur">
          <div className="space-y-0.5 text-xs">
            <p className="flex items-center gap-2 font-semibold">
              <span className="inline-flex items-center gap-1 text-success">
                <PlusCircle className="size-3.5" /> Mark {toMark.length} day{toMark.length === 1 ? "" : "s"}
                {toMark.length > 0 ? <span className="text-muted-foreground">· {formatMoney(toMarkAmount)}</span> : null}
              </span>
            </p>
            <p className="flex items-center gap-2 font-semibold">
              <span className="inline-flex items-center gap-1 text-destructive">
                <MinusCircle className="size-3.5" /> Unmark {toUnmark.length} day{toUnmark.length === 1 ? "" : "s"}
                {toUnmark.length > 0 ? <span className="text-muted-foreground">· {formatMoney(toUnmarkAmount)}</span> : null}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1"
              onClick={() => setPending(new Map())}
              disabled={!hasChanges}
            >
              <RotateCcw className="size-3.5" /> Reset
            </Button>
            <Button size="sm" className="gap-1" onClick={applyChanges} disabled={!hasChanges}>
              <Check className="size-3.5" /> Apply changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
