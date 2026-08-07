"use client";

import * as React from "react";
import { addDays } from "date-fns";
import { Check, Clock3, CircleDashed } from "lucide-react";

import { useThrift } from "@/providers/thrift-provider";
import { formatMoney, formatDate, initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getCurrentWeek, iso, parseDay } from "@/domain/calendar";
import { getSavingsOn, getWeekPayment, getWeeklyTarget } from "@/domain/calculations";
import type { Member, ThriftSettings } from "@/domain/types";

// A shareable, self-contained rendering of the family ledger. It is mounted
// off-screen so `html-to-image` can capture it into a PNG.
function memberWorkDays(member: Member, settings: ThriftSettings): number[] {
  if (member.daysPerWeek === 7) return [1, 2, 3, 4, 5, 6, 7];
  return settings.workingDays;
}

export const LedgerSnapshot = React.forwardRef<HTMLDivElement>(function LedgerSnapshot(
  _props,
  ref
) {
  const { state } = useThrift();

  if (!state) return null;

  const members = state.members.filter((m) => m.status === "active");
  const currentWeek = getCurrentWeek(state.weeks);
  const todayIso = iso(new Date());
  const weekStart = currentWeek ? parseDay(currentWeek.startDate) : null;
  const weekDays = weekStart
    ? Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
    : [];
  const totalConfirmed = state.payments
    .filter((p) => p.status === "approved")
    .reduce((sum, p) => sum + (p.amount ?? 0), 0);

  return (
    <div
      ref={ref}
      className="fixed -left-[10000px] top-0 w-[900px] rounded-2xl bg-white p-8 text-slate-900 shadow-none"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-500">Family thrift ledger</p>
          <h2 className="mt-0.5 text-2xl font-bold">{state.settings.name}</h2>
        </div>
        {currentWeek ? (
          <div className="rounded-xl bg-emerald-600 px-3 py-1.5 text-right text-white">
            <p className="text-[11px] font-semibold text-emerald-100">Week {currentWeek.number}</p>
            <p className="text-xs font-bold">
              {formatDate(currentWeek.startDate)} – {formatDate(currentWeek.endDate)}
            </p>
          </div>
        ) : null}
      </div>

      {!currentWeek || weekDays.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed py-10 text-center text-sm text-slate-400">
          No active week right now
        </div>
      ) : (
        <table className="mt-6 w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="pb-2 pr-3 text-left text-xs font-semibold text-slate-500">Day</th>
              {members.map((m) => (
                <th key={m.id} className="pb-2 text-center text-xs font-semibold text-slate-600">
                  <div className="mx-auto flex size-8 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ backgroundColor: m.color }}>
                    {initials(m.name)}
                  </div>
                  <span className="mt-1 block max-w-[72px] truncate text-[11px] font-medium">
                    {m.name.split(" ")[0]}
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
                <tr key={dateStr} className={cn(isToday && "bg-emerald-50")}>
                  <td className="py-1.5 pr-3 text-xs font-semibold text-slate-500">
                    {formatDate(dateStr, "EEE d")}
                    {isToday ? (
                      <span className="ml-1.5 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
                        today
                      </span>
                    ) : null}
                  </td>
                  {members.map((m) => {
                    const workDays = memberWorkDays(m, state.settings);
                    if (!workDays.includes(dow)) {
                      return (
                        <td key={m.id} className="px-1 py-1 text-center">
                          <span className="text-[11px] font-medium text-slate-300">·</span>
                        </td>
                      );
                    }
                    const amount = getSavingsOn(state.savings, m.id, dateStr);
                    if (amount > 0) {
                      return (
                        <td key={m.id} className="px-1 py-1 text-center">
                          <span className="inline-flex min-w-12 items-center justify-center rounded-md bg-emerald-100 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-emerald-700">
                            <Check className="mr-0.5 size-2.5" strokeWidth={3} />
                            {formatMoney(amount)}
                          </span>
                        </td>
                      );
                    }
                    if (isPast) {
                      return (
                        <td key={m.id} className="px-1 py-1 text-center">
                          <span className="inline-flex size-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                            <Check className="size-3" strokeWidth={3} />
                          </span>
                        </td>
                      );
                    }
                    if (isToday) {
                      return (
                        <td key={m.id} className="px-1 py-1 text-center">
                          <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-emerald-400 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600">
                            Today
                          </span>
                        </td>
                      );
                    }
                    return (
                      <td key={m.id} className="px-1 py-1 text-center">
                        <span className="text-[11px] font-medium text-slate-400">—</span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td className="border-t border-slate-200 pt-2 pr-3 text-xs font-semibold text-slate-500">
                Week
              </td>
              {members.map((m) => {
                const payment = getWeekPayment(state.payments, m.id, currentWeek.id);
                const target = getWeeklyTarget(state, m.id, currentWeek);
                return (
                  <td key={m.id} className="border-t border-slate-200 pt-2 text-center">
                    {payment?.status === "approved" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                        <Check className="size-2.5" strokeWidth={3} /> Paid
                        {payment.amount ? (
                          <span className="tabular-nums text-emerald-600">
                            · {formatMoney(payment.amount)}
                          </span>
                        ) : null}
                      </span>
                    ) : payment?.status === "pending" || payment?.status === "rejected" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                        <Clock3 className="size-2.5" /> Review
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                        <CircleDashed className="size-2.5" /> Pending · {formatMoney(target)}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      )}

      <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4">
        <p className="text-xs text-slate-400">
          Each past day counts as done. A week is Paid only once its receipt is confirmed.
        </p>
        <p className="text-sm font-bold text-slate-700">
          Confirmed <span className="text-emerald-600">{formatMoney(totalConfirmed)}</span>
        </p>
      </div>
    </div>
  );
});
