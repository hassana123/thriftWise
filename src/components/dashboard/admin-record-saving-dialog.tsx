"use client";

import * as React from "react";
import { Coins, History } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatMoney, formatDate, initials } from "@/lib/format";
import { useThrift } from "@/providers/thrift-provider";
import { getMemberPlan, getSavingsOn } from "@/domain/calculations";

export function AdminRecordSavingDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { state, recordSaving } = useThrift();

  const pastDays = React.useMemo(() => {
    if (!state) return [];
    const today = new Date().toISOString().slice(0, 10);
    const days: { date: string; weekId: string; weekNumber: number }[] = [];
    for (const week of state.weeks) {
      for (const day of week.days) {
        if (day.date <= today) {
          days.push({ date: day.date, weekId: week.id, weekNumber: week.number });
        }
      }
    }
    return days.sort((a, b) => b.date.localeCompare(a.date));
  }, [state]);

  const [memberId, setMemberId] = React.useState<string>("");
  const [date, setDate] = React.useState<string>("");
  const [amount, setAmount] = React.useState<string>("");

  const selectedMember = state?.members.find((m) => m.id === memberId);
  const plan = state && memberId ? getMemberPlan(state, memberId) : undefined;
  const existingAmount = state && memberId && date ? getSavingsOn(state.savings, memberId, date) : 0;

  React.useEffect(() => {
    if (open) {
      setMemberId(state?.members.find((m) => m.role === "admin")?.id ?? state?.members[0]?.id ?? "");
      setDate(pastDays[0]?.date ?? "");
      setAmount("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  React.useEffect(() => {
    if (amount === "" && existingAmount > 0) {
      setAmount(String(existingAmount));
    }
  }, [existingAmount, amount]);

  const numeric = Number(amount) || 0;

  const handleSave = () => {
    if (!state || !memberId || !date) return;
    recordSaving(memberId, date, Math.max(0, numeric));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm gap-6">
        <DialogHeader className="text-left">
          <DialogTitle>Record a past contribution</DialogTitle>
          <DialogDescription>
            Add daily savings for a member that was already paid before the app.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="admin-member">Member</Label>
            <Select value={memberId} onValueChange={setMemberId}>
              <SelectTrigger id="admin-member">
                <SelectValue placeholder="Choose a member" />
              </SelectTrigger>
              <SelectContent>
                {state?.members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    <span className="flex items-center gap-2">
                      <Avatar className="size-5">
                        <AvatarFallback style={{ backgroundColor: m.color }} className="text-[9px] text-white">
                          {initials(m.name)}
                        </AvatarFallback>
                      </Avatar>
                      {m.name}
                      {m.role === "admin" ? " (admin)" : ""}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="admin-date">Date</Label>
            <Select value={date} onValueChange={setDate}>
              <SelectTrigger id="admin-date">
                <SelectValue placeholder="Choose a date" />
              </SelectTrigger>
              <SelectContent>
                {pastDays.map((d) => (
                  <SelectItem key={d.date} value={d.date}>
                    <span className="flex items-center gap-2">
                      <History className="size-3.5 text-muted-foreground" />
                      {formatDate(d.date, "EEE, MMM d, yyyy")}
                      <span className="text-muted-foreground">· Week {d.weekNumber}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="admin-amount">Amount saved</Label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                ₦
              </span>
              <Input
                id="admin-amount"
                type="number"
                inputMode="numeric"
                min={0}
                className="pl-9 text-lg font-bold"
                placeholder={plan ? String(plan.dailyAmount) : "Amount"}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedMember ? `${selectedMember.name}’s daily plan is ${formatMoney(plan?.dailyAmount ?? 0)}.` : ""}
              {existingAmount > 0 ? ` Already recorded ${formatMoney(existingAmount)} for this date.` : ""}
            </p>
          </div>

          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleSave} disabled={!memberId || !date}>
              <Coins className="size-4" /> Save {numeric > 0 ? formatMoney(numeric) : ""}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
