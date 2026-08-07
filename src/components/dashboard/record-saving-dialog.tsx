"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Coins, PartyPopper } from "lucide-react";

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
import { formatMoney } from "@/lib/format";
import { useThrift } from "@/providers/thrift-provider";
import { useAuth } from "@/providers/auth-provider";
import { useConfetti } from "@/components/confetti";
import { getMemberPlan, getSavingsOn, getWeeklyTarget, getWeekProgress } from "@/domain/calculations";
import { getCurrentWeek } from "@/domain/calendar";

export function RecordSavingDialog({
  open,
  onOpenChange,
  date,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
}) {
  const { state, recordSaving } = useThrift();
  const { member } = useAuth();
  const fireConfetti = useConfetti();

  const plan = state && member ? getMemberPlan(state, member.id) : undefined;
  const savedToday = state && member ? getSavingsOn(state.savings, member.id, date) : 0;
  const dailyTarget = plan?.dailyAmount ?? 200;

  const [amount, setAmount] = React.useState<string>(String(savedToday || dailyTarget));
  const [justCompleted, setJustCompleted] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setAmount(String(savedToday || dailyTarget));
      setJustCompleted(false);
    }
  }, [open, savedToday, dailyTarget]);

  const currentWeek = state ? getCurrentWeek(state.weeks) : null;
  const weekProgress =
    state && member && currentWeek ? getWeekProgress(state, member.id, currentWeek) : 0;
  const weekTarget = state && member && currentWeek ? getWeeklyTarget(state, member.id, currentWeek) : 0;
  const weekSaved = state && member && currentWeek
    ? state.savings
        .filter((s) => s.memberId === member.id && s.weekId === currentWeek.id)
        .reduce((sum, s) => sum + s.amount, 0)
    : 0;

  const numeric = Number(amount) || 0;

  const handleSave = () => {
    if (!state || !member) return;
    recordSaving(member.id, date, Math.max(0, numeric));
    const newProgress =
      weekProgress === 100
        ? 100
        : Math.min(100, Math.round(((weekSaved - savedToday + numeric) / weekTarget) * 100));
    if (newProgress === 100 && weekProgress < 100) {
      setJustCompleted(true);
      fireConfetti();
    } else {
      onOpenChange(false);
    }
  };

  const chips = [dailyTarget, 300, 500].filter((c, i, arr) => arr.indexOf(c) === i);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm gap-6">
        <DialogHeader className="text-left">
          <DialogTitle>{justCompleted ? "Week complete! 🎉" : "Record today’s savings"}</DialogTitle>
          <DialogDescription>
            {member?.name} · {date}
          </DialogDescription>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {justCompleted ? (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-4 py-4 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 220, damping: 12 }}
                className="flex size-20 items-center justify-center rounded-full bg-success/15"
              >
                <PartyPopper className="size-10 text-primary" />
              </motion.div>
              <p className="text-sm text-muted-foreground">
                You reached your weekly target of{" "}
                <span className="font-semibold text-foreground">{formatMoney(weekTarget)}</span>.
                Time to transfer!
              </p>
              <Button className="w-full" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </motion.div>
          ) : (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
              <div className="flex items-center justify-between rounded-2xl bg-secondary/60 p-4">
                <div>
                  <p className="text-xs text-muted-foreground">Daily target</p>
                  <p className="text-xl font-bold">{formatMoney(dailyTarget)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Saved today</p>
                  <p className="text-xl font-bold text-primary">{formatMoney(savedToday)}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="saving-amount">Amount saved</Label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                    ₦
                  </span>
                  <Input
                    id="saving-amount"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    className="pl-9 text-lg font-bold"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  {chips.map((c) => (
                    <Button
                      key={c}
                      type="button"
                      variant={numeric === c ? "default" : "outline"}
                      size="sm"
                      className="rounded-full"
                      onClick={() => setAmount(String(c))}
                    >
                      <Coins className="size-3.5" /> {formatMoney(c)}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Weekly progress</span>
                  <span className="font-semibold text-foreground">{formatMoney(weekSaved)} / {formatMoney(weekTarget)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <motion.div
                    className="h-full rounded-full bg-primary"
                    initial={false}
                    animate={{ width: `${weekProgress}%` }}
                    transition={{ duration: 0.4 }}
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={handleSave} disabled={numeric <= 0}>
                  <Check className="size-4" /> Save {numeric > 0 ? formatMoney(numeric) : ""}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
