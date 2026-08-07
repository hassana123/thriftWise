"use client";

import * as React from "react";
import { Check, CheckCircle2, HandCoins, Undo2, UserCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useThrift } from "@/providers/thrift-provider";
import { useAuth } from "@/providers/auth-provider";
import { formatMoney, initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getCurrentWeek } from "@/domain/calendar";
import { getWeekPayment, getWeeklyTarget } from "@/domain/calculations";

export function WeekConfirm() {
  const { state, markPaidManually, unmarkPaid } = useThrift();
  const { member } = useAuth();
  const [arming, setArming] = React.useState(false);
  const [confirming, setConfirming] = React.useState<string | null>(null);

  if (!state || !member) return null;
  const week = getCurrentWeek(state.weeks);
  if (!week) return null;

  const isAdmin = member.role === "admin";
  const myPayment = getWeekPayment(state.payments, member.id, week.id);
  const myConfirmed = myPayment?.status === "approved";
  const myAmount = getWeeklyTarget(state, member.id, week);

  const confirm = (memberId: string, amount: number) => {
    markPaidManually(memberId, week.id, amount);
    setArming(false);
    setConfirming(null);
  };

  const others = state.members.filter((m) => m.status === "active" && m.id !== member.id);

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3",
          myConfirmed ? "border-success/40 bg-success/5" : "bg-secondary/40"
        )}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex size-10 items-center justify-center rounded-xl",
              myConfirmed ? "bg-success/15 text-success" : "bg-primary/10 text-primary"
            )}
          >
            {myConfirmed ? <CheckCircle2 className="size-5" /> : <HandCoins className="size-5" />}
          </div>
          <div>
            <p className="text-sm font-semibold">
              {myConfirmed ? `Week ${week.number} confirmed` : `Confirm Week ${week.number}`}
            </p>
            <p className="text-xs text-muted-foreground">
              {myConfirmed
                ? `${formatMoney(myAmount)} contribution recorded`
                : `${formatMoney(myAmount)} weekly contribution — one tap to confirm`}
            </p>
          </div>
        </div>
        {myConfirmed ? (
          <div className="flex items-center gap-2">
            <Badge variant="success" className="gap-1">
              <Check className="size-3.5" /> Done
            </Badge>
            {isAdmin ? (
              <Button size="sm" variant="ghost" className="gap-1 text-xs" onClick={() => unmarkPaid(member.id, week.id)}>
                <Undo2 className="size-3.5" /> Undo
              </Button>
            ) : null}
          </div>
        ) : arming ? (
          <div className="flex gap-2">
            <Button size="sm" onClick={() => confirm(member.id, myAmount)}>
              <Check className="size-4" /> Confirm now
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setArming(false)}>
              Back
            </Button>
          </div>
        ) : (
          <Button size="sm" onClick={() => setArming(true)}>
            <Check className="size-4" /> Confirm
          </Button>
        )}
      </div>

      {isAdmin && others.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground">Confirm family members</p>
          {others.map((m) => {
            const p = getWeekPayment(state.payments, m.id, week.id);
            const paid = p?.status === "approved";
            const amount = getWeeklyTarget(state, m.id, week);
            const isConfirming = confirming === m.id;
            return (
              <div key={m.id} className="flex items-center gap-3 rounded-xl border px-3 py-2">
                <Avatar className="size-7">
                  <AvatarFallback style={{ backgroundColor: m.color }} className="text-white text-[10px]">
                    {initials(m.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{m.name}</p>
                  <p className="text-xs text-muted-foreground">{formatMoney(amount)} this week</p>
                </div>
                {paid ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="success" className="gap-1">
                      <Check className="size-3.5" /> Paid
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 gap-1 text-xs text-muted-foreground"
                      onClick={() => unmarkPaid(m.id, week.id)}
                      title="Undo confirmation"
                    >
                      <Undo2 className="size-3.5" /> Undo
                    </Button>
                  </div>
                ) : isConfirming ? (
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="destructive" className="h-8 text-xs" onClick={() => confirm(m.id, amount)}>
                      Confirm
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setConfirming(null)}>
                      No
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 text-xs"
                    onClick={() => setConfirming(m.id)}
                  >
                    <UserCheck className="size-3.5" /> Confirm
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
