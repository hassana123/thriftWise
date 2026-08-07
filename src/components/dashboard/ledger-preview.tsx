"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, BookOpen } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useThrift } from "@/providers/thrift-provider";
import { useAuth } from "@/providers/auth-provider";
import { formatMoney, initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getCurrentWeek } from "@/domain/calendar";
import {
  buildLedger,
  LEDGER_STATUS_META,
  type LedgerStatus,
} from "@/domain/ledger";

const LEGEND_ORDER: LedgerStatus[] = ["paid", "pending", "review", "missed", "future"];

export function LedgerPreview() {
  const { state, markPaidManually, unmarkPaid } = useThrift();
  const { member } = useAuth();
  const [armed, setArmed] = React.useState<{ memberId: string; weekId: string } | null>(null);

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

  const ledger = buildLedger(state);
  const currentWeek = getCurrentWeek(state.weeks);
  const isAdmin = member.role === "admin";

  const handleUnmark = (memberId: string, weekId: string) => {
    if (armed && armed.memberId === memberId && armed.weekId === weekId) {
      unmarkPaid(memberId, weekId);
      setArmed(null);
    } else {
      setArmed({ memberId, weekId });
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <BookOpen className="size-4 text-primary" /> Family ledger
        </CardTitle>
        <Button variant="ghost" size="sm" asChild className="text-primary">
          <Link href="/ledger">
            Full ledger <ArrowUpRight className="size-3.5" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border-b px-2 py-2 text-left text-xs font-semibold text-muted-foreground">
                  Week
                </th>
                {ledger.rows.map((row) => (
                  <th
                    key={row.member.id}
                    className={cn(
                      "border-b px-2 py-2 text-center text-xs font-semibold",
                      row.member.id === member.id ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    <span className="flex flex-col items-center gap-0.5">
                      <Avatar className="size-6">
                        <AvatarFallback
                          style={{ backgroundColor: row.member.color }}
                          className="text-white text-[9px]"
                        >
                          {initials(row.member.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="max-w-[72px] truncate">{row.member.name.split(" ")[0]}</span>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ledger.weeks.map((week) => {
                const weekIndex = ledger.weeks.indexOf(week);
                const isCurrent = currentWeek?.id === week.id;
                return (
                  <tr key={week.id} className={cn(isCurrent && "bg-primary/[0.04]")}>
                    <td
                      className={cn(
                        "whitespace-nowrap border-b px-2 py-1.5 text-xs font-semibold",
                        isCurrent ? "text-primary" : "text-muted-foreground"
                      )}
                    >
                      W{week.number}
                      {isCurrent ? <span className="ml-1 text-[10px] font-medium">· now</span> : null}
                    </td>
                    {ledger.rows.map((row) => {
                      const cell = row.cells[weekIndex];
                      const meta = LEDGER_STATUS_META[cell];
                      const isArmed =
                        armed?.memberId === row.member.id && armed?.weekId === week.id;
                      const canMark = isAdmin && cell !== "paid" && cell !== "future";
                      const canUnmark = isAdmin && cell === "paid";
                      return (
                        <td key={row.member.id} className="border-b px-2 py-1.5 text-center">
                          {canMark || canUnmark ? (
                            <button
                              type="button"
                              onClick={() =>
                                canUnmark
                                  ? handleUnmark(row.member.id, week.id)
                                  : markPaidManually(row.member.id, week.id)
                              }
                              className={cn(
                                "inline-flex size-7 items-center justify-center rounded-full text-xs font-bold transition-colors",
                                canUnmark &&
                                  (isArmed
                                    ? "bg-destructive/15 text-destructive ring-2 ring-destructive/50"
                                    : "bg-success/10 hover:bg-destructive/15 hover:text-destructive"),
                                canMark &&
                                  "border border-dashed border-muted-foreground/40 text-muted-foreground/60 hover:border-primary hover:bg-primary/10 hover:text-primary"
                              )}
                              title={
                                canUnmark
                                  ? isArmed
                                    ? "Tap again to unmark"
                                    : "Paid — tap to unmark"
                                  : "Tap to mark paid"
                              }
                            >
                              {canUnmark ? (isArmed ? "?" : meta.symbol) : "+"}
                            </button>
                          ) : (
                            <span
                              className={cn(
                                "inline-flex size-6 items-center justify-center rounded-full text-xs font-bold",
                                cell === "paid" && "bg-success/10",
                                cell === "review" && "bg-warning/10",
                                cell === "missed" && "bg-destructive/10",
                                meta.className
                              )}
                              title={meta.label}
                            >
                              {meta.symbol}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-muted-foreground">
          {LEGEND_ORDER.map((s) => {
            const m = LEDGER_STATUS_META[s];
            return (
              <span key={s} className="flex items-center gap-1">
                <span className={cn("inline-flex size-3.5 items-center justify-center rounded border text-[9px] font-bold", m.className)}>
                  {m.symbol}
                </span>
                {m.label}
              </span>
            );
          })}
          {isAdmin ? (
            <span className="ml-auto rounded-lg bg-muted px-2 py-1 font-medium">
              Tap <b>+</b> to mark paid · tap a ✓ twice to undo
            </span>
          ) : null}
        </div>

        <p className="text-xs text-muted-foreground">
          Total confirmed:{" "}
          <span className="font-semibold text-foreground">{formatMoney(totalSaved)}</span>
        </p>
      </CardContent>
    </Card>
  );
}
