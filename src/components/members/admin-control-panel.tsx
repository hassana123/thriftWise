"use client";

import * as React from "react";
import { Check, HandCoins, Pencil, Settings2, ShieldCheck, Undo2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EditMemberDialog } from "@/components/members/edit-member-dialog";
import { MarkPaidDialog } from "@/components/members/mark-paid-dialog";
import { useThrift } from "@/providers/thrift-provider";
import { formatMoney, formatDate, initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getMemberPlan, getWeekPayment, getWeeklyTarget } from "@/domain/calculations";
import { getWeekStatus } from "@/domain/calendar";
import { STANDARD_PLANS, buildPlan } from "@/domain/constants";
import type { Member, PlanKey } from "@/domain/types";

export function AdminControlPanel() {
  const { state, changePlan, unmarkPaid } = useThrift();
  const [edited, setEdited] = React.useState<Record<string, string>>({});
  const [editing, setEditing] = React.useState<Member | null>(null);
  const [armed, setArmed] = React.useState<{ memberId: string; weekId: string } | null>(null);
  const [marking, setMarking] = React.useState<{ memberId: string; weekId: string } | null>(null);

  if (!state) return null;

  const today = new Date().toISOString().slice(0, 10);
  const editableWeeks = state.weeks.filter((w) => w.startDate <= today && w.endDate >= w.startDate);

  const applyPlan = (memberId: string) => {
    const key = (edited[memberId] ?? "one-hand") as PlanKey;
    const plan = key === "custom" ? buildPlan("custom", 0) : STANDARD_PLANS[key];
    if (plan.dailyAmount <= 0) return;
    changePlan(memberId, plan, "today");
    setEdited((prev) => {
      const next = { ...prev };
      delete next[memberId];
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4 text-primary" /> Admin control panel
          </CardTitle>
          <Badge variant="secondary">Full control</Badge>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
              Each member’s contribution plan
            </h3>
            <div className="space-y-2">
              {state.members.map((m) => {
                const plan = getMemberPlan(state, m.id);
                const value = edited[m.id] ?? plan?.key ?? "one-hand";
                return (
                  <div
                    key={m.id}
                    className="flex flex-wrap items-center gap-3 rounded-2xl border p-3"
                  >
                    <Avatar className="size-9">
                      <AvatarFallback style={{ backgroundColor: m.color }} className="text-white text-xs">
                        {initials(m.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {m.name}
                        {m.role === "admin" ? <span className="ml-1 text-xs text-primary">· Admin</span> : null}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {m.email ? (
                          <span className="truncate">{m.email} · </span>
                        ) : null}
                        <span className="font-semibold">{plan?.label ?? "—"}</span> ·{" "}
                        {formatMoney(plan?.dailyAmount ?? 0)}/day ·{" "}
                        {m.daysPerWeek ?? state.settings.workingDays.length} days/wk
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => setEditing(m)}
                    >
                      <Settings2 className="size-3.5" /> Edit
                    </Button>
                    <Select value={value} onValueChange={(v) => setEdited((p) => ({ ...p, [m.id]: v }))}>
                      <SelectTrigger className="w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STANDARD_PLANS).map(([key, p]) => (
                          <SelectItem key={key} value={key}>
                            {p.label} · {formatMoney(p.dailyAmount)}/day
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      variant={edited[m.id] ? "default" : "outline"}
                      className="gap-1"
                      disabled={!edited[m.id]}
                      onClick={() => applyPlan(m.id)}
                    >
                      <Pencil className="size-3.5" /> Save
                    </Button>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              The dropdown changes a plan from today onwards. Use “Edit” to also choose
              “next week” or “from the beginning” (past weeks).
            </p>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
              Mark past weeks as paid (before the app existed)
            </h3>
            <div className="overflow-x-auto rounded-2xl border">
              <table className="w-full min-w-[540px] text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Week
                    </th>
                    {state.members.map((m) => (
                      <th key={m.id} className="px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {m.name.split(" ")[0]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {editableWeeks.map((week) => {
                    const status = getWeekStatus(week);
                    return (
                      <tr key={week.id} className="border-b last:border-0">
                        <td className="px-3 py-2.5">
                          <p className="font-semibold">Week {week.number}</p>
                          <div className="flex items-center text-xs text-muted-foreground">
                            <span>{formatDate(week.startDate, "MMM d")} – {formatDate(week.endDate, "MMM d")}</span>
                            {status === "current" ? <Badge variant="secondary" className="ml-1">now</Badge> : null}
                          </div>
                        </td>
                        {state.members.map((m) => {
                          const payment = getWeekPayment(state.payments, m.id, week.id);
                          const paid = payment?.status === "approved";
                          const amount = payment?.amount ?? getWeeklyTarget(state, m.id, week);
                          const isArmed =
                            armed?.memberId === m.id && armed?.weekId === week.id;
                          return (
                            <td key={m.id} className="px-2 py-2.5 text-center">
                              {paid ? (
                                <span className="inline-flex flex-col items-center gap-1">
                                  <span className="flex items-center gap-1 text-xs font-semibold text-success">
                                    <Check className="size-3.5" /> Paid
                                    <span className="font-normal text-muted-foreground">
                                      · {formatMoney(amount)}
                                    </span>
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className={cn(
                                      "h-6 gap-1 px-2 text-[10px] font-medium text-muted-foreground hover:text-destructive",
                                      isArmed && "bg-destructive/15 text-destructive ring-2 ring-destructive/50"
                                    )}
                                    onClick={() => {
                                      if (isArmed) {
                                        unmarkPaid(m.id, week.id);
                                        setArmed(null);
                                      } else {
                                        setArmed({ memberId: m.id, weekId: week.id });
                                      }
                                    }}
                                    title={isArmed ? "Tap again to unmark" : "Unmark this week"}
                                  >
                                    <Undo2 className="size-3" />
                                    {isArmed ? "Tap again" : "Unmark"}
                                  </Button>
                                </span>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 gap-1 text-xs"
                                  onClick={() => setMarking({ memberId: m.id, weekId: week.id })}
                                >
                                  <HandCoins className="size-3.5" /> Mark paid
                                </Button>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  {editableWeeks.length === 0 ? (
                    <tr>
                      <td colSpan={state.members.length + 1} className="px-3 py-8 text-center text-sm text-muted-foreground">
                        No weeks have started yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Tap “Mark paid” to record a week that was already settled before the app existed — pick
              the week and type the exact amount each person sent. Tap “Unmark” to undo a mistake —
              confirm by tapping again.
            </p>
          </div>
        </CardContent>
      </Card>

      <EditMemberDialog
        member={editing}
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      />

      <MarkPaidDialog
        member={state.members.find((m) => m.id === marking?.memberId) ?? null}
        weeks={editableWeeks}
        open={marking !== null}
        onOpenChange={(open) => {
          if (!open) setMarking(null);
        }}
      />
    </div>
  );
}
