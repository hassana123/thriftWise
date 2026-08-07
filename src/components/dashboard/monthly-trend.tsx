"use client";

import * as React from "react";
import { format, parseISO } from "date-fns";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useThrift } from "@/providers/thrift-provider";
import { useAuth } from "@/providers/auth-provider";
import { formatMoneyCompact } from "@/lib/format";

interface TooltipProps {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}

function ChartTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border bg-background px-3 py-2 text-xs shadow-float">
      <p className="font-semibold">{label}</p>
      <p className="text-primary">{formatMoneyCompact(payload[0].value)}</p>
    </div>
  );
}

export function MonthlyTrend({ scope = "me" }: { scope?: "me" | "family" }) {
  const { state } = useThrift();
  const { member } = useAuth();

  const data = React.useMemo(() => {
    if (!state) return [];
    const filtered =
      scope === "me"
        ? state.savings.filter((s) => s.memberId === member?.id)
        : state.savings;
    const byMonth = new Map<string, number>();
    for (const s of filtered) {
      const key = format(parseISO(s.date), "yyyy-MM");
      byMonth.set(key, (byMonth.get(key) ?? 0) + s.amount);
    }
    return [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => ({
        name: format(parseISO(`${key}-01`), "MMM"),
        amount: value,
      }));
  }, [state, member?.id, scope]);

  if (data.length === 0) {
    return (
      <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">
        No savings recorded yet.
      </div>
    );
  }

  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="name"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            dy={6}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={44}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickFormatter={(v: number) => formatMoneyCompact(v)}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--border)" }} />
          <Area
            type="monotone"
            dataKey="amount"
            stroke="var(--primary)"
            strokeWidth={2.5}
            fill="url(#trendFill)"
            activeDot={{ r: 5, fill: "var(--primary)", strokeWidth: 3, stroke: "var(--background)" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
