"use client";

import * as React from "react";
import { Crown, Save, ShieldCheck, ShieldAlert } from "lucide-react";

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
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { formatMoney, initials } from "@/lib/format";
import { useThrift } from "@/providers/thrift-provider";
import { STANDARD_PLANS } from "@/domain/constants";
import { getMemberPlan } from "@/domain/calculations";
import type { Member, PlanChangeScope } from "@/domain/types";

const PLAN_SCOPES: { value: PlanChangeScope; label: string; description: string }[] = [
  { value: "today", label: "Starting now", description: "Current and future weeks" },
  { value: "next-week", label: "Starting next week", description: "Keep this week as is" },
  { value: "beginning", label: "From the beginning", description: "Also applies to past weeks" },
];

export function EditMemberDialog({
  member,
  open,
  onOpenChange,
}: {
  member: Member | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { state, updateMember, changePlan, assignAdmin } = useThrift();

  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [planKey, setPlanKey] = React.useState<string>("one-hand");
  const [daysPerWeek, setDaysPerWeek] = React.useState<number>(5);
  const [scope, setScope] = React.useState<PlanChangeScope>("today");
  const [confirmAdmin, setConfirmAdmin] = React.useState(false);

  React.useEffect(() => {
    if (open && member) {
      setName(member.name);
      setEmail(member.email ?? "");
      setPlanKey(state ? getMemberPlan(state, member.id)?.key ?? "one-hand" : "one-hand");
      setDaysPerWeek(member.daysPerWeek ?? state?.settings.workingDays.length ?? 5);
      setScope("today");
      setConfirmAdmin(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, member?.id]);

  if (!member) return null;

  const plan = STANDARD_PLANS[planKey as keyof typeof STANDARD_PLANS] ?? STANDARD_PLANS["one-hand"];

  const handleSave = () => {
    if (!name.trim()) return;
    updateMember(member.id, {
      name,
      email: email.trim() || undefined,
      daysPerWeek,
    });
    changePlan(member.id, plan, scope);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-4 text-left">
          <DialogTitle>Edit {member.name}</DialogTitle>
          <DialogDescription>
            Update their display name, email, or contribution plan.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[65dvh] space-y-4 overflow-y-auto px-6 py-5">
          <div className="flex items-center gap-3 rounded-2xl bg-secondary/50 p-3">
          <Avatar className="size-10">
            <AvatarFallback style={{ backgroundColor: member.color }} className="text-sm text-white">
              {initials(member.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{member.name}</p>
            <p className="flex items-center gap-1 text-xs capitalize text-muted-foreground">
              {member.role}
              {member.role === "admin" ? <ShieldCheck className="size-3 text-primary" /> : null}
            </p>
          </div>
          <Badge variant={member.status === "active" ? "success" : "muted"}>{member.status}</Badge>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Display name</Label>
            <Input
              id="edit-name"
              placeholder="e.g. Habiba Isah"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-email">Email (optional)</Label>
            <Input
              id="edit-email"
              type="email"
              placeholder="for their profile"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Leave blank to remove the email. They can still sign in with their name.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-plan">Contribution plan</Label>
            <Select value={planKey} onValueChange={setPlanKey}>
              <SelectTrigger id="edit-plan">
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-days">Days per week</Label>
            <div className="flex items-center gap-3">
              <Input
                id="edit-days"
                type="number"
                min={1}
                max={7}
                value={daysPerWeek}
                onChange={(e) => setDaysPerWeek(Number(e.target.value) || 1)}
                className="h-12 w-24 font-semibold"
              />
              <p className="text-xs text-muted-foreground">
                Weekly amount ≈ <span className="font-semibold text-foreground">{formatMoney(plan.dailyAmount * (daysPerWeek || 1))}</span>
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              How many days this member contributes each week. Most are 5; use 7 for someone who pays daily.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Apply change</Label>
            <RadioGroup value={scope} onValueChange={(v) => setScope(v as PlanChangeScope)} className="gap-1.5">
              {PLAN_SCOPES.map((s) => (
                <label
                  key={s.value}
                  className={`flex cursor-pointer items-start gap-2.5 rounded-xl border-2 p-2.5 transition-all ${
                    scope === s.value ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <RadioGroupItem value={s.value} className="mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">{s.label}</p>
                    <p className="text-xs text-muted-foreground">{s.description}</p>
                  </div>
                </label>
              ))}
            </RadioGroup>
          </div>

          {member.role !== "admin" ? (
            <div className="space-y-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-3">
              <div className="flex items-start gap-2.5">
                <Crown className="mt-0.5 size-4 shrink-0 text-warning" />
                <div>
                  <p className="text-sm font-semibold">Make {name.trim() || "this member"} the admin</p>
                  <p className="text-xs text-muted-foreground">
                    They get full control of the thrift. You (the current admin) become a regular member.
                  </p>
                </div>
              </div>
              {confirmAdmin ? (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    className="flex-1 gap-1"
                    onClick={() => {
                      assignAdmin(member.id);
                      onOpenChange(false);
                    }}
                  >
                    <ShieldAlert className="size-3.5" /> Yes, transfer admin
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => setConfirmAdmin(false)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" className="w-full gap-1" onClick={() => setConfirmAdmin(true)}>
                  <ShieldCheck className="size-3.5" /> Transfer admin
                </Button>
              )}
            </div>
          ) : null}
        </div>
        </div>

        <div className="flex gap-3 border-t px-6 py-4">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={handleSave} disabled={!name.trim()}>
            <Save className="size-4" /> Save changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
