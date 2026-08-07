"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";

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
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";
import { useThrift } from "@/providers/thrift-provider";
import { useAuth } from "@/providers/auth-provider";
import { STANDARD_PLANS, buildPlan } from "@/domain/constants";
import type { ContributionPlan, PlanChangeScope, PlanKey } from "@/domain/types";
import { getMemberPlan } from "@/domain/calculations";

const SCOPES: { value: PlanChangeScope; label: string; description: string }[] = [
  { value: "today", label: "Starting today", description: "Change applies from today onwards" },
  { value: "next-week", label: "Starting next week", description: "Current week stays as is" },
  { value: "beginning", label: "From beginning of thrift", description: "Backdate and settle the difference" },
];

export function ChangePlanDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { state, changePlan } = useThrift();
  const { member } = useAuth();
  const current = state && member ? getMemberPlan(state, member.id) : undefined;
  const myDaysPerWeek =
    state && member ? (state.members.find((m) => m.id === member.id)?.daysPerWeek ?? 5) : 5;
  const weeklyOf = (plan: ContributionPlan) => plan.dailyAmount * myDaysPerWeek;

  const [selectedKey, setSelectedKey] = React.useState<string>(current?.key ?? "one-hand");
  const [customAmount, setCustomAmount] = React.useState<string>("500");
  const [scope, setScope] = React.useState<PlanChangeScope>("today");
  const [outstanding, setOutstanding] = React.useState<number | undefined>(undefined);
  const [settleMode, setSettleMode] = React.useState<"pay-now" | "spread">("spread");

  React.useEffect(() => {
    if (open) {
      setSelectedKey(current?.key ?? "one-hand");
      setScope("today");
      setOutstanding(undefined);
    }
  }, [open, current]);

  const selectedPlan: ContributionPlan = React.useMemo(() => {
    if (selectedKey === "custom") {
      const daily = Number(customAmount) || 0;
      return buildPlan("custom", daily);
    }
    return STANDARD_PLANS[selectedKey as PlanKey] ?? buildPlan("custom", 0);
  }, [selectedKey, customAmount]);

  const remainingWeeks = state ? state.weeks.filter((w) => w.endDate >= new Date().toISOString().slice(0, 10)).length : 0;
  const spreadAmount = outstanding && remainingWeeks > 0 ? outstanding / remainingWeeks : 0;

  const handlePreview = () => {
    if (!state || !member) return;
    const out = changePlan(member.id, selectedPlan, scope);
    if (scope === "beginning") {
      setOutstanding(out);
    }
  };

  const handleConfirm = () => {
    if (!state || !member) return;
    changePlan(member.id, selectedPlan, scope);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader className="text-left">
          <DialogTitle>Change contribution plan</DialogTitle>
          <DialogDescription>
            {member?.name} · currently {current?.label} ({formatMoney(current?.dailyAmount ?? 0)}/day)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          {Object.entries(STANDARD_PLANS).map(([key, plan]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedKey(key)}
              className={cn(
                "flex w-full items-center justify-between rounded-2xl border-2 p-4 text-left transition-all",
                selectedKey === key
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40"
              )}
            >
              <div>
                <p className="font-semibold">{plan.label}</p>
                <p className="text-xs text-muted-foreground">
                  ₦{plan.dailyAmount}/day · ₦{formatMoney(weeklyOf(plan))}/week
                </p>
              </div>
              {selectedKey === key ? <Badge variant="success">Selected</Badge> : null}
            </button>
          ))}

          <button
            type="button"
            onClick={() => setSelectedKey("custom")}
            className={cn(
              "flex w-full flex-col gap-2 rounded-2xl border-2 p-4 text-left transition-all",
              selectedKey === "custom"
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/40"
            )}
          >
            <div className="flex items-center justify-between">
              <p className="font-semibold">Custom Plan</p>
              {selectedKey === "custom" ? <Badge variant="success">Selected</Badge> : null}
            </div>
            {selectedKey === "custom" ? (
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-muted-foreground">₦</span>
                <Input
                  type="number"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  className="h-9 max-w-[120px] font-semibold"
                  placeholder="Daily amount"
                />
                <span className="text-xs text-muted-foreground">
                  = {formatMoney(selectedPlan.dailyAmount * myDaysPerWeek)}/week
                </span>
              </div>
            ) : null}
          </button>
        </div>

        <Separator />

        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-primary" /> Apply change
          </Label>
          <RadioGroup value={scope} onValueChange={(v) => setScope(v as PlanChangeScope)} className="gap-2">
            {SCOPES.map((s) => (
              <label
                key={s.value}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-3 transition-all",
                  scope === s.value ? "border-primary bg-primary/5" : "border-border"
                )}
              >
                <RadioGroupItem value={s.value} className="mt-0.5" />
                <div>
                  <p className="text-sm font-semibold">{s.label}</p>
                  <p className="text-xs text-muted-foreground">{s.description}</p>
                </div>
              </label>
            ))}
          </RadioGroup>
        </div>

        <AnimatePresence>
          {scope === "beginning" ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="space-y-3 rounded-2xl bg-secondary/60 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Old weekly amount</span>
                  <span className="font-semibold">{formatMoney(current ? weeklyOf(current) : 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">New weekly amount</span>
                  <span className="font-semibold">{formatMoney(weeklyOf(selectedPlan))}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Difference / week</span>
                  <span className="font-semibold">
                    {formatMoney(Math.abs(weeklyOf(selectedPlan) - (current ? weeklyOf(current) : 0)))}
                  </span>
                </div>
                <Separator />
                {outstanding !== undefined ? (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">Outstanding balance</span>
                    <span className="text-lg font-bold text-primary">{formatMoney(outstanding)}</span>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" className="w-full" onClick={handlePreview}>
                    Calculate outstanding balance <ArrowRight className="size-3.5" />
                  </Button>
                )}
                {outstanding !== undefined && outstanding > 0 ? (
                  <RadioGroup value={settleMode} onValueChange={(v) => setSettleMode(v as "pay-now" | "spread")} className="gap-2 pt-1">
                    <label className="flex cursor-pointer items-center gap-2 rounded-xl border p-2.5">
                      <RadioGroupItem value="pay-now" />
                      <div>
                        <p className="text-sm font-medium">Pay now</p>
                        <p className="text-xs text-muted-foreground">Settle the full balance immediately</p>
                      </div>
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 rounded-xl border p-2.5">
                      <RadioGroupItem value="spread" />
                      <div>
                        <p className="text-sm font-medium">Spread across remaining weeks</p>
                        <p className="text-xs text-muted-foreground">
                          ≈ {formatMoney(Math.ceil(spreadAmount))}/week over {remainingWeeks} weeks
                        </p>
                      </div>
                    </label>
                  </RadioGroup>
                ) : null}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={handleConfirm} disabled={selectedPlan.dailyAmount <= 0}>
            Save plan
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
