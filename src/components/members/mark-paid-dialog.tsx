"use client";

import * as React from "react";
import { HandCoins, Sparkles } from "lucide-react";

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
import { getMemberPlan, getPlanForWeek, getWeeklyTarget } from "@/domain/calculations";
import type { Member, ThriftWeek } from "@/domain/types";

interface MarkPaidDialogProps {
  member: Member | null;
  weeks: ThriftWeek[];
  defaultWeekId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MarkPaidDialog({
  member,
  weeks,
  defaultWeekId,
  open,
  onOpenChange,
}: MarkPaidDialogProps) {
  const { state, markPaidManually } = useThrift();
  const [weekId, setWeekId] = React.useState(defaultWeekId);
  const [amount, setAmount] = React.useState("");

  React.useEffect(() => {
    if (open && state) {
      setWeekId(defaultWeekId);
      const week = weeks.find((w) => w.id === defaultWeekId);
      const target = week ? getWeeklyTarget(state, member?.id ?? "", week) : 0;
      setAmount(target > 0 ? String(target) : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultWeekId]);

  if (!state || !member) return null;

  const week = weeks.find((w) => w.id === weekId);
  const target = week ? getWeeklyTarget(state, member.id, week) : 0;
  const daily = week
    ? getPlanForWeek(state, member.id, week).dailyAmount || getMemberPlan(state, member.id).dailyAmount
    : getMemberPlan(state, member.id).dailyAmount;
  const parsed = Math.round(Number(amount) || 0);
  const days = parsed > 0 && daily > 0 ? Math.floor(parsed / daily) : 0;
  const matchesTarget = parsed === target;

  const confirm = () => {
    if (!week) return;
    markPaidManually(member.id, week.id, parsed > 0 ? parsed : undefined);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader className="text-left">
          <DialogTitle className="flex items-center gap-2">
            <Avatar className="size-8">
              <AvatarFallback style={{ backgroundColor: member.color }} className="text-white text-xs">
                {initials(member.name)}
              </AvatarFallback>
            </Avatar>
            Mark {member.name.split(" ")[0]} as paid
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Which week?</Label>
            <Select value={weekId} onValueChange={setWeekId}>
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
            <p className="text-xs text-muted-foreground">
              {week ? (
                <>
                  Target for this week: <b className="text-foreground">{formatMoney(target)}</b> (
                  {week.days.length} day{week.days.length === 1 ? "" : "s"} × {formatMoney(daily)})
                </>
              ) : null}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="paid-amount">Amount {member.name.split(" ")[0]} sent</Label>
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
                onChange={(e) => setAmount(e.target.value)}
                placeholder={String(target)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {parsed > 0 && daily > 0 ? (
                days > 0 ? (
                  <>
                    Covers <b className="text-foreground">{days} day{days === 1 ? "" : "s"}</b> at{" "}
                    {formatMoney(daily)}/day
                    {week && days > week.days.length ? " — extra days roll into the next week(s)." : ""}
                  </>
                ) : (
                  <>
                    That’s less than one day at {formatMoney(daily)}/day — nothing will be recorded.
                  </>
                )
              ) : (
                "Leave blank to record the full weekly target."
              )}
              {matchesTarget ? (
                <span className="flex items-center gap-1 text-success">
                  <Sparkles className="size-3" /> Matches the week target
                </span>
              ) : null}
            </p>
          </div>

          <Button className="w-full gap-1" onClick={confirm}>
            <HandCoins className="size-4" /> Confirm paid
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            You can still change this later from Settings → Admin control panel.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
