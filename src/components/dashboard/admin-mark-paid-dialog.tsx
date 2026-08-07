"use client";

import * as React from "react";
import { Check, HandCoins } from "lucide-react";

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
import { getWeekPayment, getWeeklyTarget } from "@/domain/calculations";

export function AdminMarkPaidDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { state, markPaidManually } = useThrift();

  const pastWeeks = React.useMemo(() => {
    if (!state) return [];
    const today = new Date().toISOString().slice(0, 10);
    return state.weeks.filter((w) => w.startDate <= today);
  }, [state]);

  const [memberId, setMemberId] = React.useState<string>("");
  const [weekId, setWeekId] = React.useState<string>("");
  const [amount, setAmount] = React.useState<string>("");

  const selectedWeek = pastWeeks.find((w) => w.id === weekId);
  const existingPayment =
    state && memberId && weekId
      ? getWeekPayment(state.payments, memberId, weekId)
      : undefined;
  const defaultAmount =
    state && memberId && selectedWeek ? getWeeklyTarget(state, memberId, selectedWeek) : 0;

  React.useEffect(() => {
    if (open) {
      setMemberId(state?.members[0]?.id ?? "");
      setWeekId(pastWeeks[0]?.id ?? "");
      setAmount("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const numeric = Number(amount) || 0;
  const alreadyPaid = existingPayment?.status === "approved";

  const handleSave = () => {
    if (!state || !memberId || !weekId) return;
    markPaidManually(memberId, weekId, numeric || undefined);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm gap-6">
        <DialogHeader className="text-left">
          <DialogTitle>Mark week as paid</DialogTitle>
          <DialogDescription>
            Manually record that a member has settled a week’s contribution.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="paid-member">Member</Label>
            <Select value={memberId} onValueChange={setMemberId}>
              <SelectTrigger id="paid-member">
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
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="paid-week">Week</Label>
            <Select value={weekId} onValueChange={setWeekId}>
              <SelectTrigger id="paid-week">
                <SelectValue placeholder="Choose a week" />
              </SelectTrigger>
              <SelectContent>
                {pastWeeks.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    <span className="flex items-center gap-2">
                      Week {w.number}
                      <span className="text-muted-foreground">
                        · {formatDate(w.startDate, "MMM d")} – {formatDate(w.endDate, "MMM d")}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="paid-amount">Amount (optional)</Label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                ₦
              </span>
              <Input
                id="paid-amount"
                type="number"
                inputMode="numeric"
                min={0}
                className="pl-9 text-lg font-bold"
                placeholder={String(defaultAmount)}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Leave blank to use the weekly target of {formatMoney(defaultAmount)}.
            </p>
          </div>

          {alreadyPaid ? (
            <p className="flex items-center gap-2 rounded-xl bg-success/10 px-3 py-2 text-xs font-medium text-success">
              <Check className="size-3.5" /> This week is already marked paid.
            </p>
          ) : null}

          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleSave} disabled={!memberId || !weekId}>
              <HandCoins className="size-4" /> Mark paid
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
