"use client";

import * as React from "react";
import { BookOpen, HandCoins, Share2, ShieldCheck } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AdminMarkPaidDialog } from "@/components/dashboard/admin-mark-paid-dialog";
import { useThrift } from "@/providers/thrift-provider";
import { useAuth } from "@/providers/auth-provider";
import { formatMoney, initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getCurrentWeek } from "@/domain/calendar";
import { getFamilySavings, getMemberPlan } from "@/domain/calculations";
import {
  buildLedger,
  LEDGER_STATUS_META,
  type LedgerStatus,
} from "@/domain/ledger";

const LEGEND_ORDER: LedgerStatus[] = ["paid", "pending", "review", "missed", "future"];

export default function LedgerPage() {
  const { state, unmarkPaid } = useThrift();
  const { member } = useAuth();
  const [markOpen, setMarkOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [armed, setArmed] = React.useState<{ memberId: string; weekId: string } | null>(null);

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

  const buildLedgerText = () => {
    const lines: string[] = [];
    lines.push(`${state.settings.name} — Family Contribution Ledger`);
    lines.push("");
    const nameWidth = Math.max(...ledger.rows.map((r) => r.member.name.length), 6) + 2;
    const header = `Member${" ".repeat(Math.max(0, nameWidth - 6))}` +
      ledger.weeks.map((w) => `W${w.number}`.padStart(4)).join("");
    lines.push(header);
    for (const row of ledger.rows) {
      lines.push(
        row.member.name.padEnd(nameWidth) +
          row.cells.map((c) => LEDGER_STATUS_META[c].symbol.padStart(4)).join("")
      );
    }
    lines.push("");
    lines.push("✓ Paid  ◷ Pending  ⚠ Needs review  ✕ Missed  · Not due yet");
    return lines.join("\n");
  };

  const handleShare = async () => {
    const text = buildLedgerText();
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: `${state.settings.name} — Contribution Ledger`, text });
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // user cancelled the share sheet
    }
  };

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
            Total saved: <span className="font-semibold text-foreground">{formatMoney(getFamilySavings(state))}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-2" onClick={handleShare}>
            <Share2 className="size-4" /> {copied ? "Copied!" : "Share ledger"}
          </Button>
          {isAdmin ? (
            <Button size="sm" variant="outline" className="gap-2" onClick={() => setMarkOpen(true)}>
              <HandCoins className="size-4" /> Record past weeks
            </Button>
          ) : null}
        </div>
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
                  const isMe = row.member.id === member.id;
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
                        const isArmed =
                          armed?.memberId === row.member.id && armed?.weekId === week.id;
                        const canUnmark = isAdmin && cell === "paid";
                        return (
                          <td
                            key={week.id}
                            className={cn(
                              "border-b px-2 py-2.5 text-center",
                              isCurrent && "bg-primary/[0.04]"
                            )}
                          >
                            {canUnmark ? (
                              <button
                                type="button"
                                onClick={() => handleUnmark(row.member.id, week.id)}
                                className={cn(
                                  "inline-flex size-7 items-center justify-center rounded-full text-xs font-bold transition-colors",
                                  isArmed
                                    ? "bg-destructive/15 text-destructive ring-2 ring-destructive/50"
                                    : "bg-success/10 hover:bg-destructive/15 hover:text-destructive"
                                )}
                                title={isArmed ? "Tap again to unmark" : "Paid — tap to unmark"}
                              >
                                {isArmed ? "?" : meta.symbol}
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
        </CardContent>
      </Card>

      <p className="flex items-center gap-2 rounded-2xl border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
        <ShieldCheck className="size-4 shrink-0 text-primary" />
        Paid (✓) means the week was confirmed settled. Pending (◷) means it isn&apos;t due or
        hasn&apos;t been confirmed yet. Needs review (⚠) means a receipt is waiting for the admin.
        {isAdmin ? " As admin, tap any ✓ to unmark a mistaken confirmation (tap twice to confirm)." : " A week can be recorded retroactively any time."}
      </p>

      <AdminMarkPaidDialog open={markOpen} onOpenChange={setMarkOpen} />
    </div>
  );
}
