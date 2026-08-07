"use client";

import * as React from "react";
import { format } from "date-fns";
import { Check, HandCoins, Minus, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useThrift } from "@/providers/thrift-provider";
import { formatMoney, formatDate, initials } from "@/lib/format";
import { parseDay } from "@/domain/calendar";
import { getPlanForWeek, getWeeklyTarget } from "@/domain/calculations";
import { cn } from "@/lib/utils";
import type { Member, ThriftWeek } from "@/domain/types";

interface MarkPaidDialogProps {
  member: Member | null;
  weeks: ThriftWeek[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MarkPaidDialog({ member, weeks, open, onOpenChange }: MarkPaidDialogProps) {
  const { state, markDaysPaid } = useThrift();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    if (open) setSelected(new Set());
  }, [open, member?.id]);

  if (!state || !member) return null;

  const coveredDates = new Set(
    state.savings.filter((s) => s.memberId === member.id).map((s) => s.date)
  );
  const toggle = (date: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };
  const toggleWeek = (week: ThriftWeek) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const unpaid = week.days.filter((d) => !coveredDates.has(d.date));
      const allSelected = unpaid.every((d) => next.has(d.date));
      for (const d of unpaid) {
        if (allSelected) next.delete(d.date);
        else next.add(d.date);
      }
      return next;
    });
  };

  const total = [...selected].reduce((sum, date) => {
    const week = weeks.find((w) => w.days.some((d) => d.date === date));
    if (!week) return sum;
    return sum + getPlanForWeek(state, member.id, week).dailyAmount;
  }, 0);
  const days = selected.size;

  const confirm = () => {
    if (days === 0) return;
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
            Tap the exact days they contributed — you can pick days from different weeks.
          </p>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {weeks.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No weeks have started yet.
            </p>
          ) : (
            weeks.map((week) => {
              const covered = week.days.filter((d) => coveredDates.has(d.date)).length;
              const unpaid = week.days.filter((d) => !coveredDates.has(d.date));
              const weekSelected = unpaid.filter((d) => selected.has(d.date)).length;
              const target = getWeeklyTarget(state, member.id, week);
              const daily = getPlanForWeek(state, member.id, week).dailyAmount;
              return (
                <div key={week.id} className="rounded-2xl border p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">
                        Week {week.number}
                        {covered === week.days.length ? (
                          <span className="ml-1.5 text-xs font-medium text-success">· fully paid</span>
                        ) : null}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(week.startDate, "MMM d")} – {formatDate(week.endDate, "MMM d")} ·{" "}
                        {covered}/{week.days.length} days · {formatMoney(target)}
                      </p>
                    </div>
                    {unpaid.length > 0 ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 shrink-0 gap-1 px-2 text-[11px] font-medium"
                        onClick={() => toggleWeek(week)}
                      >
                        {weekSelected === unpaid.length && weekSelected > 0 ? (
                          <>
                            <Minus className="size-3" /> Clear
                          </>
                        ) : (
                          <>
                            <Sparkles className="size-3" /> Select all
                          </>
                        )}
                      </Button>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {week.days.map((d) => {
                      const isCovered = coveredDates.has(d.date);
                      const isSelected = selected.has(d.date);
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
                                ? `${formatMoney(daily)} — tap to remove`
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
                </div>
              );
            })
          )}
        </div>

        <div className="shrink-0 border-t bg-muted/30 px-5 py-3">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {days} day{days === 1 ? "" : "s"} selected
            </span>
            <span className="text-base font-bold tabular-nums">{formatMoney(total)}</span>
          </div>
          <Button className="w-full gap-1" onClick={confirm} disabled={days === 0}>
            <HandCoins className="size-4" /> Confirm {days} day{days === 1 ? "" : "s"} as paid
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
