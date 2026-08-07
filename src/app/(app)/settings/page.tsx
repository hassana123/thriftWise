"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Bell,
  Building2,
  CalendarDays,
  LogOut,
  Palette,
  RefreshCcw,
  RotateCcw,
  User,
  Users,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useThrift } from "@/providers/thrift-provider";
import { useAuth } from "@/providers/auth-provider";
import { useTheme } from "@/components/theme-provider";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { FULL_DAY_LABELS } from "@/domain/constants";
import type { ThriftSettings } from "@/domain/types";
import { getReminderPrefs, setReminderPrefs } from "@/domain/reminders";

export default function SettingsPage() {
  const { state, updateSettings, resetThrift } = useThrift();
  const { member, user, signOut, mode } = useAuth();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [notifications, setNotifications] = React.useState(getReminderPrefs());
  const [confirmReset, setConfirmReset] = React.useState(false);

  if (!state || !member) return null;

  const isAdmin = member.role === "admin";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="size-4 text-primary" /> Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Avatar className="size-14">
              <AvatarFallback style={{ backgroundColor: member.color }} className="text-white text-lg">
                {initials(member.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-bold">{member.name}</p>
              <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
              <Badge variant="secondary" className="mt-1 capitalize">
                {member.role}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {isAdmin ? (
        <>
          <ThriftSettingsCard
            settings={state.settings}
            onSave={(patch) => updateSettings(patch)}
          />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="size-4 text-primary" /> Members
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {state.members.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 rounded-2xl border p-3">
                    <Avatar className="size-9">
                      <AvatarFallback style={{ backgroundColor: m.color }} className="text-white text-xs">
                        {initials(m.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{m.name}</p>
                      <p className="text-xs text-muted-foreground">{m.email ?? "—"}</p>
                    </div>
                    <Badge variant={m.status === "active" ? "success" : "muted"}>{m.status}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="size-4 text-primary" /> Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ToggleRow
            label="Saving reminders"
            description="Get reminded to save on contribution days"
            checked={notifications.saving}
            onCheckedChange={(v) => {
              setNotifications((n) => {
                const next = { ...n, saving: v };
                setReminderPrefs(next);
                return next;
              });
            }}
          />
          <ToggleRow
            label="Behind-target alerts"
            description="A nudge when you're behind your weekly goal"
            checked={notifications.behind}
            onCheckedChange={(v) => {
              setNotifications((n) => {
                const next = { ...n, behind: v };
                setReminderPrefs(next);
                return next;
              });
            }}
          />
          <ToggleRow
            label="Transfer reminders"
            description="A reminder to transfer your weekly contribution"
            checked={notifications.transfer}
            onCheckedChange={(v) => {
              setNotifications((n) => {
                const next = { ...n, transfer: v };
                setReminderPrefs(next);
                return next;
              });
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="size-4 text-primary" /> Appearance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Theme</p>
              <p className="text-xs text-muted-foreground">Choose how ThriftWise looks</p>
            </div>
            <div className="flex gap-1 rounded-xl bg-muted p-1">
              {(["light", "dark", "system"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors",
                    theme === t ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-destructive">
            <RotateCcw className="size-4" /> Danger zone
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isAdmin && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Reset thrift data</p>
                  <p className="text-xs text-muted-foreground">Restore the demo dataset and start fresh</p>
                </div>
                {confirmReset ? (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        resetThrift();
                        setConfirmReset(false);
                      }}
                    >
                      Yes, reset
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setConfirmReset(false)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setConfirmReset(true)}>
                    Reset
                  </Button>
                )}
              </div>
              <Separator />
            </>
          )}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Sign out</p>
              <p className="text-xs text-muted-foreground">{mode === "demo" ? "Demo session" : "Supabase session"}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                await signOut();
                router.replace("/login");
              }}
            >
              <LogOut className="size-4" /> Sign out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function ThriftSettingsCard({
  settings,
  onSave,
}: {
  settings: ThriftSettings;
  onSave: (patch: Partial<ThriftSettings>) => void;
}) {
  const [form, setForm] = React.useState<Partial<ThriftSettings>>({});
  const [days, setDays] = React.useState<number[]>(settings.workingDays);
  const [saved, setSaved] = React.useState(false);

  const patch = { ...settings, ...form, workingDays: days };
  const baseAccount = settings.paymentAccount;
  const patchAccount = { ...baseAccount, ...(form.paymentAccount ?? {}) };

  function persist() {
    onSave({
      name: patch.name,
      vacationDate: patch.vacationDate,
      startDate: patch.startDate,
      workingDays: days,
      defaultDailyAmount: patch.defaultDailyAmount,
      paymentAccount: patchAccount,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="size-4 text-primary" /> Thrift settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Vacation name</Label>
          <Input value={patch.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <CalendarDays className="size-3.5" /> Start date
            </Label>
            <Input type="date" value={patch.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <CalendarDays className="size-3.5" /> Vacation date
            </Label>
            <Input type="date" value={patch.vacationDate} onChange={(e) => setForm((f) => ({ ...f, vacationDate: e.target.value }))} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Contribution days</Label>
          <div className="flex flex-wrap gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7].map((dow) => {
              const selected = days.includes(dow);
              return (
                <button
                  key={dow}
                  type="button"
                  onClick={() =>
                    setDays(selected ? days.filter((d) => d !== dow) : [...days, dow].sort())
                  }
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-semibold transition-all",
                    selected ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"
                  )}
                >
                  {FULL_DAY_LABELS[dow - 1]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Default daily amount (₦)</Label>
            <Input
              type="number"
              value={patch.defaultDailyAmount}
              onChange={(e) => setForm((f) => ({ ...f, defaultDailyAmount: Number(e.target.value) }))}
            />
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <Label>Payment account</Label>
          <div className="grid gap-3 sm:grid-cols-3">
            <Input placeholder="Bank" value={patchAccount.bank} onChange={(e) => setForm((f) => ({ ...f, paymentAccount: { ...baseAccount, ...(f.paymentAccount ?? {}), bank: e.target.value } }))} />
            <Input placeholder="Account name" value={patchAccount.accountName} onChange={(e) => setForm((f) => ({ ...f, paymentAccount: { ...baseAccount, ...(f.paymentAccount ?? {}), accountName: e.target.value } }))} />
            <Input placeholder="Account number" value={patchAccount.accountNumber} onChange={(e) => setForm((f) => ({ ...f, paymentAccount: { ...baseAccount, ...(f.paymentAccount ?? {}), accountNumber: e.target.value } }))} />
          </div>
        </div>

        <Button onClick={persist} className="w-full gap-2">
          {saved ? <motion.span initial={{ scale: 0.8 }} animate={{ scale: 1 }}>Saved ✓</motion.span> : <><RefreshCcw className="size-4" /> Save changes</>}
        </Button>
      </CardContent>
    </Card>
  );
}
