"use client";

import * as React from "react";
import { format, isSameMonth, isSameDay, isBefore } from "date-fns";
import { Check, Minus } from "lucide-react";

import { cn } from "@/lib/utils";
import { useThrift } from "@/providers/thrift-provider";
import { useAuth } from "@/providers/auth-provider";
import { getMemberPlan, getSavingsOn } from "@/domain/calculations";
import { isWorkingDay } from "@/domain/calendar";
import { formatMoney } from "@/lib/format";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function ContributionCalendar() {
  const { state } = useThrift();
  const { member } = useAuth();
  const [month, setMonth] = React.useState(() => new Date());

  const cells = React.useMemo(() => {
    const result: (Date | null)[] = [];
    if (!state) return result;
    const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const firstDow = (firstOfMonth.getDay() + 6) % 7;
    for (let i = 0; i < firstDow; i++) result.push(null);
    for (let d = 1; d <= daysInMonth; d++) result.push(new Date(month.getFullYear(), month.getMonth(), d));
    return result;
  }, [month, state]);

  const monthStats = React.useMemo(() => {
    let savedDays = 0;
    let workingDays = 0;
    let total = 0;
    if (!state || !member) return { savedDays, workingDays, total };
    for (const cell of cells) {
      if (!cell || !isWorkingDay(cell, state.settings)) continue;
      workingDays++;
      const amount = getSavingsOn(state.savings, member.id, format(cell, "yyyy-MM-dd"));
      if (amount > 0) {
        savedDays++;
        total += amount;
      }
    }
    return { savedDays, workingDays, total };
  }, [cells, state, member]);

  if (!state || !member) return null;

  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstOfMonth = new Date(year, monthIndex, 1);
  const plan = getMemberPlan(state, member.id);
  const today = new Date();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMonth(new Date(year, monthIndex - 1, 1))}
            className="flex size-8 items-center justify-center rounded-lg border text-sm font-semibold transition-colors hover:bg-accent"
            aria-label="Previous month"
          >
            ‹
          </button>
          <button
            onClick={() => setMonth(new Date(year, monthIndex + 1, 1))}
            className="flex size-8 items-center justify-center rounded-lg border text-sm font-semibold transition-colors hover:bg-accent"
            aria-label="Next month"
          >
            ›
          </button>
          <span className="text-sm font-semibold">{format(month, "MMMM yyyy")}</span>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <p>
            {monthStats.savedDays}/{monthStats.workingDays} days
          </p>
          <p className="font-semibold text-foreground">{formatMoney(monthStats.total)}</p>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {DAY_LABELS.map((d) => (
          <div key={d} className="pb-1 text-center text-[10px] font-semibold uppercase text-muted-foreground">
            {d}
          </div>
        ))}
        {cells.map((cell, i) => {
          if (!cell) return <div key={`empty-${i}`} />;
          const isCurrentMonth = isSameMonth(cell, firstOfMonth);
          const working = isWorkingDay(cell, state.settings);
          const isoDate = format(cell, "yyyy-MM-dd");
          const saved = getSavingsOn(state.savings, member.id, isoDate);
          const isToday = isSameDay(cell, today);
          const isPastOrToday = !isBefore(today, cell);

          let style = "border-transparent text-muted-foreground/60";
          let icon: React.ReactNode = null;
          if (isCurrentMonth) {
            if (!working) {
              style = "text-muted-foreground/30";
            } else if (saved > 0) {
              style = "bg-primary text-primary-foreground border-transparent shadow-sm";
              icon = <Check className="size-3.5" strokeWidth={3} />;
            } else if (isPastOrToday && !isSameDay(cell, today)) {
              style = "bg-warning/20 text-warning border-warning/40";
              icon = <Minus className="size-3.5" strokeWidth={3} />;
            } else if (isToday) {
              style = "border-primary text-primary bg-primary/5";
            }
          }

          return (
            <div
              key={isoDate}
              title={working ? `${isoDate} — ${formatMoney(saved)} saved` : isoDate}
              className={cn(
                "flex aspect-square flex-col items-center justify-center rounded-xl border text-xs font-medium transition-all",
                style,
                !isCurrentMonth && "opacity-30"
              )}
            >
              {icon}
              <span className={cn(saved > 0 || !working ? "" : "mt-0.5")}>{cell.getDate()}</span>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-md bg-primary" /> Saved
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-md border border-warning/50 bg-warning/20" /> Missed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-md border border-primary" /> Today
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-md bg-muted-foreground/20" /> Rest day
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Daily target · <span className="font-semibold text-foreground">{formatMoney(plan.dailyAmount)}</span>
      </p>
    </div>
  );
}
