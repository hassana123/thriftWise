"use client";

import * as React from "react";
import { format } from "date-fns";
import { Check, HandCoins } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useThrift } from "@/providers/thrift-provider";
import { formatMoney, formatDate, initials } from "@/lib/format";
import { parseDay } from "@/domain/calendar";
import {
  getPlanForWeek,
  getWeekSavings,
  getWeeklyTarget,
  planDayCoverage,
} from "@/domain/calculations";
import { cn } from "@/lib/utils";
import type { Member, ThriftWeek } from "@/domain/types";

interface MarkPaidDialogProps {
  member: Member | null;
  weeks: ThriftWeek[];
  startWeekId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MarkPaidDialog({
  member,
  weeks,
  startWeekId,
  open,
  onOpenChange,
}: MarkPaidDialogProps) {
  const { state, markDaysPaid } = useThrift();
  const [weekId, setWeekId] = React.useState(startWeekId);
  const [amount, setAmount] = React.useState("");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const listRef = React.useRef<HTMLDivElement>(null);

  const entered = Math.round(Number(amount) || 0);

  React.useEffect(() => {
    if (open) {
      setWeekId(startWeekId);
      setAmount("");
      setSelected(new Set());
      // Bring the week the admin clicked into view.
      requestAnimationFrame(() => {
        const container = listRef.current;
        if (!container) return;
        const target = container.querySelector<HTMLElement>(`[data-week-card="${startWeekId}"]`);
        if (!target) return;
        const top = target.offsetTop - container.clientHeight / 2 + target.clientHeight / 2;
        container.scrollTo({ top: Math.max(0, top), behavior: "auto" });
      });
    }
  }, [open, startWeekId]);

  if (!state || !member) return null;

  const coveredDates = new Set(
    state.savings.filter((s) => s.memberId === member.id).map((s) => s.date)
  );
  const week = weeks.find((w) => w.id === weekId);
  const startTarget = week ? getWeeklyTarget(state, member.id, week) : 0;

  const dailyFor = (date: string) => {
    const w = weeks.find((x) => x.days.some((d) => d.date === date));
    return w ? getPlanForWeek(state, member.id, w).dailyAmount : 0;
  };

  const syncAmountFrom = (days: Set<string>) => {
    const total = [...days].reduce((sum, d) => sum + dailyFor(d), 0);
    setAmount(total > 0 ? String(total) : "");
  };

  const handleAmountChange = (value: string) => {
    setAmount(value);
    const parsed = Math.round(Number(value) || 0);
    if (parsed > 0) {
      const dates = planDayCoverage(state, member.id, weekId, parsed).flatMap((c) => c.dates);
      setSelected(new Set(dates));
    } else {
      setSelected(new Set());
    }
  };

  const handleWeekChange = (id: string) => {
    setWeekId(id);
    if (entered > 0) {
      const dates = planDayCoverage(state, member.id, id, entered).flatMap((c) => c.dates);
      setSelected(new Set(dates));
    }
  };

  const toggle = (date: string) => {
    const next = new Set(selected);
    if (next.has(date)) next.delete(date);
    else next.add(date);
    setSelected(next);
    syncAmountFrom(next);
  };

  // Selecting a week's checkbox picks all of that week's still-unpaid days.
  const toggleWeek = (week: ThriftWeek) => {
    const unpaid = week.days.filter((d) => !coveredDates.has(d.date));
    const next = new Set(selected);
    const allSelected = unpaid.length > 0 && unpaid.every((d) => next.has(d.date));
    for (const d of unpaid) {
      if (allSelected) next.delete(d.date);
      else next.add(d.date);
    }
    setSelected(next);
    syncAmountFrom(next);
  };

  const total = [...selected].reduce((sum, d) => sum + dailyFor(d), 0);
  const selectedByWeek = weeks
    .map((w) => ({
      week: w,
      dates: w.days.filter((d) => selected.has(d.date) && !coveredDates.has(d.date)).map((d) => d.date),
    }))
    .filter((c) => c.dates.length > 0);

  const confirm = () => {
    if (selected.size === 0) return;
    markDaysPaid(member.id, [...selected]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] flex-col gap-0 p-0 sm:max-w-md">
        <DialogHeader className="shrink-0 border-b px-5 pb-4 pt-5 text-left">
          <DialogTitle className="flex items-center gap-2">
            <Avatar className="size-8">
              <AvatarFallback style={{ backgroundColor: member.color }} className="text-white text-xs">
                {initials(member.name)}
              </AvatarFallback>
            </Avatar>
            Mark {member.name.split(" ")[0]} as paid
          </DialogTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Type what {member.name.split(" ")[0]} paid. Any amount beyond this week’s Mon–Fri
            automatically covers the next week’s earliest unpaid days.
          </p>
        </DialogHeader>

        <div
          ref={listRef}
          className="relative min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4"
        >
          <div className="space-y-1.5">
            <Label>Starting from which week?</Label>
            <Select value={weekId} onValueChange={handleWeekChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {weeks.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    Week {w.number} · {formatDate(w.startDate, "MMM d")} – {formatDate(w.endDate, "MMM d")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="paid-amount">Amount paid</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                ₦
              </span>
              <Input
                id="paid-amount"
                type="number"
                inputMode="numeric"
                min={0}
                className="pl-7"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder={String(startTarget)}
              />
            </div>
            {selected.size > 0 ? (
              <p className="text-xs text-muted-foreground">
                {formatMoney(total)} = {selected.size} day{selected.size === 1 ? "" : "s"}:{" "}
                {selectedByWeek
                  .map((c) => `Week ${c.week.number} (${c.dates.length} day${c.dates.length === 1 ? "" : "s"})`)
                  .join(" + ")}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Leave blank or use ₦0 to clear the selection.
              </p>
            )}
          </div>

          <div className="space-y-3">
            {weeks.map((week) => {
              const covered = week.days.filter((d) => coveredDates.has(d.date)).length;
              const saved = getWeekSavings(state.savings, member.id, week.id);
              const target = getWeeklyTarget(state, member.id, week);
              const unpaid = week.days.filter((d) => !coveredDates.has(d.date));
              const weekSelected = unpaid.filter((d) => selected.has(d.date));
              const allSelected = unpaid.length > 0 && weekSelected.length === unpaid.length;
              return (
                <div
                  key={week.id}
                  data-week-card={week.id}
                  className="rounded-2xl border p-3"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleWeek(week)}
                        disabled={unpaid.length === 0}
                        title={
                          unpaid.length === 0
                            ? "This week is already fully paid"
                            : allSelected
                              ? "Deselect all days this week"
                              : "Select all days this week"
                        }
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                          allSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input hover:border-primary/50",
                          unpaid.length === 0 && "cursor-not-allowed opacity-40"
                        )}
                      >
                        {allSelected ? <Check className="size-3.5" strokeWidth={3} /> : null}
                      </button>
                      <p className="text-sm font-semibold">
                        Week {week.number}
                        {covered === week.days.length ? (
                          <span className="ml-1.5 text-xs font-medium text-success">· fully paid</span>
                        ) : covered > 0 ? (
                          <span className="ml-1.5 text-xs font-medium text-warning">
                            · {formatMoney(saved)}/{formatMoney(target)} paid
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(week.startDate, "MMM d")} – {formatDate(week.endDate, "MMM d")}
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {week.days.map((d) => {
                      const isCovered = coveredDates.has(d.date);
                      const isSelected = selected.has(d.date);
                      const daily = dailyFor(d.date);
                      return (
                        <button
                          key={d.date}
                          type="button"
                          disabled={isCovered}
                          onClick={() => toggle(d.date)}
                          className={cn(
                            "flex flex-col items-center rounded-xl border py-1.5 text-xs font-semibold transition-colors",
                            isCovered &&
                              "cursor-not-allowed border-success/25 bg-success/10 text-success",
                            !isCovered &&
                              !isSelected &&
                              "border-border text-foreground hover:bg-muted",
                            !isCovered &&
                              isSelected &&
                              "border-primary bg-primary text-primary-foreground"
                          )}
                          title={
                            isCovered
                              ? "Already marked as paid"
                              : isSelected
                                ? `${format(parseDay(d.date), "EEEE, MMM d")} · ${formatMoney(daily)} — tap to remove`
                                : `${format(parseDay(d.date), "EEEE, MMM d")} · ${formatMoney(daily)}`
                          }
                        >
                          <span className="text-[10px] font-medium opacity-70">
                            {format(parseDay(d.date), "EEE")}
                          </span>
                          {format(parseDay(d.date), "d")}
                          {isCovered ? <Check className="size-3" strokeWidth={3} /> : null}
                        </button>
                      );
                    })}
                  </div>
                  {weekSelected.length > 0 ? (
                    <p className="mt-1.5 text-[11px] font-medium text-primary">
                      This payment marks {weekSelected.length} day{weekSelected.length === 1 ? "" : "s"} here
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <div className="shrink-0 border-t bg-muted/30 px-5 py-3">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {selected.size} day{selected.size === 1 ? "" : "s"} to mark
            </span>
            <span className="text-base font-bold tabular-nums">{formatMoney(total)}</span>
          </div>
          <Button className="w-full gap-1" onClick={confirm} disabled={selected.size === 0}>
            <HandCoins className="size-4" /> Confirm {formatMoney(total)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
