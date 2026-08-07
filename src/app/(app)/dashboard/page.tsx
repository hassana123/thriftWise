"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Coins,
  Flame,
  HandCoins,
  Plane,
  Plus,
  Sparkles,
  TrendingUp,
  Trophy,
  ArrowUpRight,
  Users,
  PartyPopper,
} from "lucide-react";
import { motion } from "framer-motion";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ProgressRing } from "@/components/progress-ring";
import { Progress } from "@/components/ui/progress";
import { StaggerItem } from "@/components/page-transition";
import { RecordSavingDialog } from "@/components/dashboard/record-saving-dialog";
import { ChangePlanDialog } from "@/components/dashboard/change-plan-dialog";
import { ContributionCalendar } from "@/components/dashboard/contribution-calendar";
import { MonthlyTrend } from "@/components/dashboard/monthly-trend";
import { WeeklyPaymentCard } from "@/components/dashboard/weekly-payment-card";
import { PaymentHistoryCard } from "@/components/dashboard/payment-history-card";
import { LedgerPreview } from "@/components/dashboard/ledger-preview";
import { useMemberStats } from "@/components/dashboard/use-member-stats";
import { useThrift } from "@/providers/thrift-provider";
import { useAuth } from "@/providers/auth-provider";
import { formatMoney, formatDate, formatMoneyCompact, initials, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getFamilyGoal, getFamilyRanking, getFamilyTransferred, getTotalSaved } from "@/domain/calculations";
import { isWorkingDay } from "@/domain/calendar";
import type { Member } from "@/domain/types";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function friendlyHint(
  stats: NonNullable<ReturnType<typeof useMemberStats>>
): string {
  if (stats.streak >= 7) {
    return `Amazing ${stats.streak}-day streak — the family is proud of you 🔥`;
  }
  if (stats.streak >= 3) {
    return `On a ${stats.streak}-day roll, keep it going!`;
  }
  if (stats.weekProgress === 100) {
    return "This week is fully complete — nice work! 🎉";
  }
  if (stats.weekRemaining > 0) {
    return `You’re ${formatMoneyCompact(stats.weekRemaining)} away from this week’s goal`;
  }
  return "Every little bit gets us closer to vacation ✈️";
}

export default function DashboardPage() {
  const { state, isReady } = useThrift();
  const { member } = useAuth();
  const stats = useMemberStats(state, member?.id);

  const [recordOpen, setRecordOpen] = React.useState(false);
  const [planOpen, setPlanOpen] = React.useState(false);

  if (!isReady || !state || !member || !stats) {
    return <DashboardSkeleton />;
  }

  const todayIso = format(new Date(), "yyyy-MM-dd");
  const isWorkingToday = isWorkingDay(new Date(), state.settings);
  const isAdmin = member.role === "admin";

  return (
    <div className="space-y-6">
      <StaggerItem>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar className="size-12 ring-2 ring-primary/20 sm:size-14">
              <AvatarFallback style={{ backgroundColor: member.color }} className="text-base text-white sm:text-lg">
                {initials(member.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm text-muted-foreground">
                {format(new Date(), "EEEE, MMMM d")}
              </p>
              <h2 className="truncate text-xl font-bold tracking-tight sm:text-2xl">
                {greeting()}, {member.name.split(" ")[0]}!
              </h2>
              <p className="truncate text-sm text-muted-foreground">{friendlyHint(stats)}</p>
            </div>
          </div>
          <Badge variant="secondary" className="gap-1.5 px-3 py-1.5">
            <Plane className="size-3.5" />
            {pluralize(stats.vacationDaysLeft, "day")} to go
          </Badge>
        </div>
      </StaggerItem>

      <WeeklyPaymentCard />

      <LedgerPreview />

      {!isAdmin ? (
        <p className="text-center text-xs text-muted-foreground">
          {state.settings.name} family goal:{" "}
          <span className="font-semibold text-foreground">{formatMoney(getFamilyGoal(state))}</span>
        </p>
      ) : null}

      {isAdmin ? (
        <>
          <HeroCard
            stats={stats}
            vacationName={state.settings.name}
            onRecord={() => setRecordOpen(true)}
            onPlan={() => setPlanOpen(true)}
          />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={Flame}
              label="Saving streak"
              value={`${stats.streak} ${pluralize(stats.streak, "day")}`}
              hint={stats.streak > 0 ? "Keep the fire burning" : "Save today to start a streak"}
              accent="text-warning"
            />
            <StatCard
              icon={CheckCircle2}
              label="Completed weeks"
              value={`${stats.completedWeeks}/${stats.elapsedWeeks}`}
              hint={stats.pendingWeeks > 0 ? `${stats.pendingWeeks} pending review` : "All weeks so far done"}
              accent="text-primary"
            />
            <StatCard
              icon={HandCoins}
              label="Outstanding"
              value={formatMoneyCompact(stats.outstanding)}
              hint={stats.outstanding > 0 ? "Awaiting settlement" : "All settled up"}
              accent="text-destructive"
            />
            <StatCard
              icon={Trophy}
              label="Family rank"
              value={`#${stats.rank} of ${stats.memberCount}`}
              hint="Based on total savings"
              accent="text-warning"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Coins className="size-4 text-primary" /> This week
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats.currentWeek ? (
                  <div className="space-y-5">
                    <WeekProgress
                      weekNumber={stats.currentWeek.number}
                      range={[stats.currentWeek.startDate, stats.currentWeek.endDate]}
                      target={stats.weeklyTarget}
                      saved={stats.weekSaved}
                      progress={stats.weekProgress}
                      daysCompleted={stats.daysCompletedInWeek}
                      totalDays={stats.totalDaysInWeek}
                      remaining={stats.weekRemaining}
                      isWorkingToday={isWorkingToday}
                      todayTarget={stats.todayTarget}
                      savedToday={stats.savedToday}
                      onRecord={() => setRecordOpen(true)}
                    />
                  </div>
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No active week.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="size-4 text-primary" /> Family ranking
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FamilyRankingList currentMemberId={member.id} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarDays className="size-4 text-primary" /> Contribution calendar
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ContributionCalendar />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="size-4 text-primary" /> Monthly trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <MonthlyTrend scope="me" />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <RecentActivity />
            <SavingsHistory savings={stats.savingsHistory} />
          </div>

          <PaymentHistoryCard />
        </>
      ) : null}

      <RecordSavingDialog open={recordOpen} onOpenChange={setRecordOpen} date={todayIso} />
      <ChangePlanDialog open={planOpen} onOpenChange={setPlanOpen} />
    </div>
  );
}

function HeroCard({
  stats,
  vacationName,
  onRecord,
  onPlan,
}: {
  stats: NonNullable<ReturnType<typeof useMemberStats>>;
  vacationName: string;
  onRecord: () => void;
  onPlan: () => void;
}) {
  const { state } = useThrift();
  const family = state?.members.filter((m) => m.status !== "suspended") ?? [];
  const familyGoal = state ? getFamilyGoal(state) : 0;
  const familyTransferred = state ? getFamilyTransferred(state) : 0;
  const familyReadiness =
    familyGoal > 0 ? Math.min(100, Math.round((familyTransferred / familyGoal) * 100)) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-900 text-white shadow-float"
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-emerald-300/30 blur-3xl"
        animate={{ x: [0, -18, 0], y: [0, 14, 0], scale: [1, 1.08, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-16 size-80 rounded-full bg-teal-300/20 blur-3xl"
        animate={{ x: [0, 18, 0], y: [0, -14, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
          backgroundSize: "22px 22px",
        }}
      />

      <div className="relative grid gap-6 p-5 sm:gap-8 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="space-y-5 sm:space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur">
              <Sparkles className="size-3.5" /> {vacationName}
            </span>
            <AvatarStack members={family} />
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/60">
              Saving toward
            </p>
            <h2 className="truncate text-2xl font-bold tracking-tight sm:text-4xl">{vacationName}</h2>
          </div>

          <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
            <HeroStat label="Your balance" value={formatMoney(stats.balance)} />
            <HeroStat label="Family saved" value={formatMoneyCompact(stats.familySavings)} />
            <HeroStat label="Days to go" value={pluralize(stats.vacationDaysLeft, "day")} />
          </div>

          <div className="flex gap-2.5 pt-1">
            <Button
              size="sm"
              className="h-11 flex-1 rounded-xl bg-white px-3 font-semibold text-emerald-700 shadow-lg shadow-emerald-950/20 hover:bg-white/90 sm:flex-none sm:px-5"
              onClick={onRecord}
            >
              <Plus className="size-4" /> Record savings
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-11 flex-1 rounded-xl border border-white/20 bg-white/10 px-3 text-white hover:bg-white/20 sm:flex-none sm:px-5"
              onClick={onPlan}
            >
              Change plan
            </Button>
          </div>
        </div>

        <HeroImage
          vacationName={vacationName}
          readiness={familyReadiness}
          transferred={familyTransferred}
          totalGoal={familyGoal}
        />
      </div>
    </motion.div>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/10 p-2.5 backdrop-blur sm:p-3.5">
      <p className="truncate text-[10px] font-medium text-white/60 sm:text-[11px]">{label}</p>
      <p className="mt-0.5 truncate text-base font-bold leading-tight sm:text-xl">{value}</p>
    </div>
  );
}

function AvatarStack({ members }: { members: Member[] }) {
  const visible = members.slice(0, 5);
  const hidden = members.length - visible.length;
  return (
    <div className="flex -space-x-2.5">
      {visible.map((m) => (
        <Avatar key={m.id} className="size-8 ring-2 ring-emerald-700">
          <AvatarFallback style={{ backgroundColor: m.color }} className="text-[10px] text-white">
            {initials(m.name)}
          </AvatarFallback>
        </Avatar>
      ))}
      {hidden > 0 ? (
        <div className="flex size-8 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold text-white ring-2 ring-emerald-700 backdrop-blur">
          +{hidden}
        </div>
      ) : null}
    </div>
  );
}

function HeroImage({
  vacationName,
  readiness,
  transferred,
  totalGoal,
}: {
  vacationName: string;
  readiness: number;
  transferred: number;
  totalGoal: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="relative w-full overflow-hidden rounded-3xl border border-white/15 shadow-2xl shadow-emerald-950/40 lg:w-72 xl:w-80"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80"
        alt={vacationName}
        className="aspect-[4/3] w-full object-cover lg:aspect-[4/5]"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-emerald-950/90 via-emerald-950/20 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/70">
          Family goal
        </p>
        <p className="text-2xl font-bold leading-tight">{formatMoney(totalGoal)}</p>
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/20">
          <div
            className="h-full rounded-full bg-white transition-[width] duration-700"
            style={{ width: `${Math.min(100, Math.max(0, readiness))}%` }}
          />
        </div>
        <p className="mt-1.5 text-xs text-white/80">
          {formatMoneyCompact(transferred)} transferred · {readiness}% of goal
        </p>
      </div>
    </motion.div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: string;
  accent: string;
}) {
  return (
    <StaggerItem>
      <Card className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="mt-1 text-xl font-bold tracking-tight">{value}</p>
          </div>
          <div className={cn("flex size-9 items-center justify-center rounded-xl bg-muted", accent)}>
            <Icon className="size-[18px]" />
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
      </Card>
    </StaggerItem>
  );
}

function WeekProgress({
  weekNumber,
  range,
  target,
  saved,
  progress,
  daysCompleted,
  totalDays,
  remaining,
  isWorkingToday,
  todayTarget,
  savedToday,
  onRecord,
}: {
  weekNumber: number;
  range: [string, string];
  target: number;
  saved: number;
  progress: number;
  daysCompleted: number;
  totalDays: number;
  remaining: number;
  isWorkingToday: boolean;
  todayTarget: number;
  savedToday: number;
  onRecord: () => void;
}) {
  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
      <ProgressRing value={progress} size={132} strokeWidth={12}>
        <div className="text-center">
          <p className="text-2xl font-bold">{progress}%</p>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">complete</p>
        </div>
      </ProgressRing>

      <div className="min-w-0 flex-1 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">Week {weekNumber}</p>
            <p className="text-xs text-muted-foreground">
              {formatDate(range[0])} – {formatDate(range[1])}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold">
              <span className="text-primary">{formatMoney(saved)}</span>
              <span className="text-muted-foreground"> / {formatMoney(target)}</span>
            </p>
            <p className="text-xs text-muted-foreground">weekly goal</p>
          </div>
        </div>

        <Progress value={progress} className="h-2.5" />

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-secondary/60 p-2.5">
            <p className="text-lg font-bold">{daysCompleted}/{totalDays}</p>
            <p className="text-[11px] text-muted-foreground">days done</p>
          </div>
          <div className="rounded-xl bg-secondary/60 p-2.5">
            <p className="text-lg font-bold text-primary">{formatMoneyCompact(remaining)}</p>
            <p className="text-[11px] text-muted-foreground">remaining</p>
          </div>
          <div className="rounded-xl bg-secondary/60 p-2.5">
            <p className="text-lg font-bold">{progress}%</p>
            <p className="text-[11px] text-muted-foreground">progress</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed p-3">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Clock3 className="size-4" />
            </div>
            <div>
              <p className="text-sm font-medium">
                {isWorkingToday
                  ? `Today’s target · ${formatMoney(todayTarget)}`
                  : "No contribution today — rest day"}
              </p>
              <p className="text-xs text-muted-foreground">
                {savedToday > 0 ? `${formatMoney(savedToday)} saved today ✅` : "Nothing recorded yet today"}
              </p>
            </div>
          </div>
          {isWorkingToday ? (
            <Button size="sm" onClick={onRecord}>
              <Plus className="size-4" /> Record
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function FamilyRankingList({ currentMemberId }: { currentMemberId: string }) {
  const { state } = useThrift();
  if (!state) return null;
  const ranking = getFamilyRanking(state);
  const top = ranking[0];

  return (
    <ol className="space-y-2.5">
      {ranking.map((m, i) => {
        const saved = getTotalSaved(state, m.id);
        const pct = top ? Math.round((saved / Math.max(1, getTotalSaved(state, top.id))) * 100) : 0;
        return (
          <li key={m.id} className="flex items-center gap-3">
            <span className={cn("w-5 text-center text-sm font-bold", i === 0 ? "text-warning" : "text-muted-foreground")}>
              {i + 1}
            </span>
            <Avatar className="size-9">
              <AvatarFallback style={{ backgroundColor: m.color }} className="text-white text-xs">
                {initials(m.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <p className={cn("truncate text-sm font-medium", m.id === currentMemberId && "text-primary")}>
                  {m.name}
                  {m.id === currentMemberId ? " (you)" : ""}
                </p>
                <p className="text-sm font-semibold">{formatMoneyCompact(saved)}</p>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function RecentActivity() {
  const { state } = useThrift();
  if (!state) return null;

  const activities = state.activities.slice(0, 6);

  const iconFor = (type: string) => {
    switch (type) {
      case "saving":
        return <Coins className="size-4" />;
      case "payment_uploaded":
        return <ArrowUpRight className="size-4" />;
      case "payment_approved":
        return <CheckCircle2 className="size-4 text-primary" />;
      case "payment_rejected":
        return <PartyPopper className="size-4 text-warning" />;
      case "plan_change":
        return <Sparkles className="size-4 text-primary" />;
      case "week_completed":
        return <PartyPopper className="size-4 text-primary" />;
      case "member_joined":
        return <Users className="size-4" />;
      default:
        return <Coins className="size-4" />;
    }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock3 className="size-4 text-primary" /> Recent activity
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {activities.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          activities.map((a) => (
            <div key={a.id} className="flex items-start gap-3 rounded-xl p-2 transition-colors hover:bg-muted/60">
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {iconFor(a.type)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{a.message}</p>
                <p className="text-xs text-muted-foreground">{formatDate(a.createdAt, "MMM d, h:mm a")}</p>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function SavingsHistory({ savings }: { savings: { date: string; amount: number }[] }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="size-4 text-primary" /> Savings history
        </CardTitle>
        <Button variant="ghost" size="sm" asChild className="text-primary">
          <Link href="/ledger">
            View ledger <ArrowUpRight className="size-3.5" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {savings.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nothing saved yet.</p>
        ) : (
          <div className="space-y-1">
            {savings.map((s) => (
              <div key={s.date} className="flex items-center justify-between rounded-xl p-2.5 transition-colors hover:bg-muted/60">
                <div className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-secondary">
                    <Coins className="size-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{formatDate(s.date, "EEE, MMM d")}</p>
                    <p className="text-xs text-muted-foreground">Daily savings</p>
                  </div>
                </div>
                <span className="font-semibold text-primary">+{formatMoney(s.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-64" />
      </div>
      <Skeleton className="h-64 rounded-3xl" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-72 lg:col-span-2" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}
