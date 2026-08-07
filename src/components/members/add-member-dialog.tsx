"use client";

import * as React from "react";
import { Check, UserPlus } from "lucide-react";

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
import { formatMoney } from "@/lib/format";
import { useThrift } from "@/providers/thrift-provider";
import { STANDARD_PLANS } from "@/domain/constants";
import type { ContributionPlan } from "@/domain/types";

const PLAN_OPTIONS: ContributionPlan[] = [
  STANDARD_PLANS["one-hand"],
  STANDARD_PLANS["one-half-hand"],
  STANDARD_PLANS["two-hands"],
];

export function AddMemberDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { addMember, state } = useThrift();

  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [planKey, setPlanKey] = React.useState<string>("one-hand");
  const [daysPerWeek, setDaysPerWeek] = React.useState<number>(5);
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setName("");
      setEmail("");
      setPlanKey("one-hand");
      setDaysPerWeek(state?.settings.workingDays.length ?? 5);
      setSaved(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const plan = PLAN_OPTIONS.find((p) => p.key === planKey) ?? STANDARD_PLANS["one-hand"];

  const handleSave = () => {
    if (!name.trim() || !state) return;
    addMember({ name, email: email.trim() || undefined, plan, daysPerWeek });
    setSaved(true);
    setTimeout(() => onOpenChange(false), 900);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm gap-6">
        <DialogHeader className="text-left">
          <DialogTitle>{saved ? "Member added 🎉" : "Add a family member"}</DialogTitle>
          <DialogDescription>
            {saved
              ? `${name.trim()} can now sign in with their name.`
              : "They can sign in with just their name — no email or password needed."}
          </DialogDescription>
        </DialogHeader>

        {saved ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-success/15">
              <Check className="size-8 text-success" strokeWidth={2.5} />
            </div>
            <p className="text-sm text-muted-foreground">
              Tell {name.trim()} to open the app and tap their name to get in.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="member-name">Full name</Label>
              <Input
                id="member-name"
                placeholder="e.g. Habiba Isah"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="member-email">Email (optional)</Label>
              <Input
                id="member-email"
                type="email"
                placeholder="for their profile"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="member-plan">Contribution plan</Label>
              <Select value={planKey} onValueChange={setPlanKey}>
                <SelectTrigger id="member-plan">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLAN_OPTIONS.map((p) => (
                    <SelectItem key={p.key} value={p.key}>
                      {p.label} · {formatMoney(p.dailyAmount)}/day
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="member-days">Days per week</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="member-days"
                  type="number"
                  min={1}
                  max={7}
                  value={daysPerWeek}
                  onChange={(e) => setDaysPerWeek(Number(e.target.value) || 1)}
                  className="h-12 w-24 font-semibold"
                />
                <p className="text-xs text-muted-foreground">
                  Weekly amount ≈{" "}
                  <span className="font-semibold text-foreground">
                    {formatMoney(plan.dailyAmount * (daysPerWeek || 1))}
                  </span>
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                How many days they contribute each week. Most are 5; use 7 for someone who pays daily.
              </p>
            </div>
            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleSave} disabled={!name.trim()}>
                <UserPlus className="size-4" /> Add member
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
