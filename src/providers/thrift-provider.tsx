"use client";

import * as React from "react";

import type {
  ContributionPlan,
  DaySaving,
  Member,
  OnboardingInput,
  PlanChangeScope,
  ThriftSettings,
  ThriftState,
} from "@/domain/types";
import { generateWeeks, getCurrentWeek, iso, parseDay } from "@/domain/calendar";
import { buildPlan, planKeyFromAmount, AVATAR_COLORS } from "@/domain/constants";
import { getRepository, seedDemoState } from "@/lib/repository";
import { getSupabaseMode } from "@/lib/supabase/config";
import { deleteReceipt } from "@/lib/upload";
import { getTotalTransferred, getWeeklyTarget, fillWeekSavings, getPlanForWeek, getMemberPlan, resyncMemberWeeks } from "@/domain/calculations";
import { ensureReminders } from "@/domain/reminders";
import { applyAutoSave } from "@/domain/auto-save";

interface ThriftContextValue {
  state: ThriftState | null;
  isReady: boolean;
  isReloading: boolean;
  mode: "supabase" | "demo";
  memberLookup: (id: string) => Member | null;
  recordSaving: (memberId: string, date: string, amount: number) => void;
  uploadReceipt: (
    memberId: string,
    weekId: string,
    receiptUrl: string,
    amount?: number,
    autoApproved?: boolean,
    daysCovered?: number
  ) => void;
  approvePayment: (memberId: string, weekId: string) => void;
  rejectPayment: (memberId: string, weekId: string, note?: string) => void;
  markPaidManually: (memberId: string, weekId: string, amount?: number) => void;
  unmarkPaid: (memberId: string, weekId: string) => void;
  changePlan: (
    memberId: string,
    plan: ContributionPlan,
    scope: PlanChangeScope
  ) => number | undefined;
  addMember: (input: { name: string; email?: string; plan: ContributionPlan; daysPerWeek?: number }) => void;
  updateMember: (memberId: string, patch: { name?: string; email?: string; daysPerWeek?: number }) => void;
  moveMember: (memberId: string, direction: "up" | "down") => void;
  assignAdmin: (memberId: string) => void;
  markNotificationsRead: () => void;
  createThrift: (input: OnboardingInput) => void;
  updateSettings: (patch: Partial<ThriftSettings>) => void;
  resetThrift: () => void;
  clearAll: () => void | Promise<void>;
}

const ThriftContext = React.createContext<ThriftContextValue | undefined>(undefined);

const CLEAR_FLAG_KEY = "thriftwise-cleared";

export function ThriftProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<ThriftState | null>(null);
  const [isReady, setIsReady] = React.useState(false);
  const [isReloading, setIsReloading] = React.useState(true);
  const repository = React.useMemo(() => getRepository(), []);
  const mode = repository.mode;

  React.useEffect(() => {
    let cancelled = false;

    const loadState = async () => {
      setIsReloading(true);
      const repo = getRepository();
      let loaded = await repo.load();
      if (!loaded) {
        if (repo.mode === "demo" && !window.localStorage.getItem(CLEAR_FLAG_KEY)) {
          loaded = seedDemoState();
          repo.save(loaded);
        }
      }
      if (!cancelled) {
        setState(loaded?.thrift ? ensureReminders(loaded.thrift) : null);
        setIsReloading(false);
      }
    };

    if (mode === "demo") {
      loadState().then(() => {
        if (!cancelled) setIsReady(true);
      });
      return () => {
        cancelled = true;
      };
    }

    // Supabase: load once, then keep in sync with the auth session. Otherwise,
    // loading state while signed out (anon RLS may return nothing) leaves the
    // app empty after the admin signs back in.
    let unsubAuth: (() => void) | undefined;
    import("@/lib/supabase/client").then(({ getSupabaseClient }) => {
      const sb = getSupabaseClient();
      const refresh = (clear: boolean) => {
        if (cancelled) return;
        if (clear) setState(null);
        loadState();
      };
      loadState();
      const { data: sub } = sb.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
          refresh(false);
        } else if (event === "SIGNED_OUT") {
          // Keep the loaded thrift in memory after logging out so the family
          // login page still lists members (anon RLS may hide the row). It
          // reloads fresh when the next user signs in.
        }
      });
      unsubAuth = sub.subscription.unsubscribe;
      if (!cancelled) setIsReady(true);
    });

    return () => {
      cancelled = true;
      unsubAuth?.();
    };
  }, [mode]);

  // Refresh reminders periodically so "due today" alerts appear during a session.
  React.useEffect(() => {
    const id = window.setInterval(() => {
      setState((prev) => (prev ? ensureReminders(prev) : prev));
    }, 60 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  // Auto-record each day's saving once the day's cutoff passes, so nobody has
  // to remember to tap "saved". Idempotent — already-recorded days are skipped.
  React.useEffect(() => {
    if (!isReady) return;
    const tick = () => setState((prev) => (prev ? applyAutoSave(prev) : prev));
    tick();
    const id = window.setInterval(tick, 60 * 1000);
    return () => window.clearInterval(id);
  }, [isReady]);

  React.useEffect(() => {
    if (isReady && state) {
      repository.save({ version: 1, thrift: state });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, isReady]);

  const memberLookup = React.useCallback(
    (id: string) => state?.members.find((m) => m.id === id) ?? null,
    [state]
  );

  const pushActivity = React.useCallback(
    (
      prev: ThriftState,
      actorId: string,
      type: ThriftState["activities"][number]["type"],
      message: string,
      amount?: number
    ): ThriftState => {
      return {
        ...prev,
        activities: [
          {
            id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            thriftId: prev.id,
            actorId,
            type,
            message,
            amount,
            createdAt: iso(new Date()),
          },
          ...prev.activities,
        ],
      };
    },
    []
  );

  const recordSaving = React.useCallback(
    (memberId: string, date: string, amount: number) => {
      setState((prev) => {
        if (!prev) return prev;
        const week = prev.weeks.find((w) =>
          w.days.some((d) => d.date === date)
        );
        if (!week) return prev;
        const existing = prev.savings.find(
          (s) => s.memberId === memberId && s.date === date
        );
        const savings = existing
          ? prev.savings.map((s) =>
              s.id === existing.id ? { ...s, amount } : s
            )
          : [
              ...prev.savings,
              {
                id: `${memberId}-${date}`,
                memberId,
                weekId: week.id,
                date,
                amount,
              },
            ];
        const member = prev.members.find((m) => m.id === memberId);
        let next: ThriftState = { ...prev, savings };
        if (amount > 0) {
          next = pushActivity(
            next,
            memberId,
            "saving",
            `${member?.name ?? "Member"} saved ${formatMoneyLabel(amount)} today`,
            amount
          );
        }
        return next;
      });
    },
    [pushActivity]
  );

  const uploadReceipt = React.useCallback(
    (memberId: string, weekId: string, receiptUrl: string, amount?: number, autoApproved?: boolean, daysCovered?: number) => {
      setState((prev) => {
        if (!prev) return prev;
        const startWeek = prev.weeks.find((w) => w.id === weekId);
        if (!startWeek) return prev;
        const plan = getMemberPlan(prev, memberId);
        // Default is one working week (Mon–Fri). People sometimes pay ahead:
        // 7 days = this week + Mon/Tue next week, 10 days = two full weeks.
        // Weekends are never counted — only working days across consecutive weeks.
        const defaultDays = startWeek.days.length || 5;
        const totalDays = daysCovered && daysCovered > 0 ? Math.floor(daysCovered) : defaultDays;
        const receiptAmount = amount && amount > 0 ? amount : plan.dailyAmount * totalDays;
        const perDay = receiptAmount / totalDays;
        const isAutoApproved = Boolean(autoApproved) && receiptAmount > 0;
        const status = isAutoApproved ? ("approved" as const) : ("pending" as const);
        const now = iso(new Date());

        const startIndex = prev.weeks.findIndex((w) => w.id === weekId);
        let remainingDays = totalDays;
        let remainingAmount = receiptAmount;
        let payments = prev.payments;
        let savings = prev.savings;
        const coveredWeekNumbers: number[] = [];
        let i = startIndex;
        while (remainingDays > 0 && i < prev.weeks.length) {
          const week = prev.weeks[i];
          const daysInWeek = week.days.length;
          const covered = Math.min(remainingDays, daysInWeek);
          const weekAmount = i === prev.weeks.length - 1
            ? remainingAmount
            : Math.round(perDay * covered);
          remainingDays -= covered;
          remainingAmount -= weekAmount;
          coveredWeekNumbers.push(week.number);

          const existing = payments.find(
            (p) => p.memberId === memberId && p.weekId === week.id
          );
          const payment = existing
            ? {
                ...existing,
                amount: weekAmount,
                receiptUrl,
                receiptStatus: status,
                status,
                approvedAt: isAutoApproved ? now : existing.approvedAt,
              }
            : {
                id: `${memberId}-${week.id}`,
                memberId,
                weekId: week.id,
                amount: weekAmount,
                status,
                method: "transfer" as const,
                receiptUrl,
                receiptStatus: status,
                approvedAt: isAutoApproved ? now : undefined,
                createdAt: now,
              };
          payments = existing
            ? payments.map((p) => (p.id === payment.id ? payment : p))
            : [...payments, payment];
          savings = fillWeekSavings(
            { ...prev, payments, savings },
            memberId,
            week.id,
            weekAmount,
            covered
          );
          i += 1;
        }

        const member = prev.members.find((m) => m.id === memberId);
        const weeksLabel =
          coveredWeekNumbers.length > 1
            ? `Weeks ${coveredWeekNumbers[0]}–${coveredWeekNumbers[coveredWeekNumbers.length - 1]}`
            : `Week ${coveredWeekNumbers[0]}`;
        return pushActivity(
          { ...prev, payments, savings },
          memberId,
          isAutoApproved ? "payment_approved" : "payment_uploaded",
          isAutoApproved
            ? `${member?.name ?? "Member"}’s ${weeksLabel} payment was verified automatically (${totalDays} days)`
            : `${member?.name ?? "Member"} uploaded a receipt covering ${totalDays} days (${weeksLabel})`,
          receiptAmount
        );
      });
    },
    [pushActivity]
  );

  const setPaymentStatus = React.useCallback(
    (
      memberId: string,
      weekId: string,
      status: "approved" | "rejected",
      note?: string
    ) => {
      setState((prev) => {
        if (!prev) return prev;
        const target = prev.payments.find(
          (p) => p.memberId === memberId && p.weekId === weekId
        );
        if (target?.receiptUrl) {
          void deleteReceipt(target.receiptUrl);
        }
        const week = prev.weeks.find((w) => w.id === weekId);
        const approvedAmount = week ? getWeeklyTarget(prev, memberId, week) : 0;
        const payments = prev.payments.map((p) =>
          p.memberId === memberId && p.weekId === weekId
            ? {
                ...p,
                amount: status === "approved" && !p.amount ? approvedAmount : p.amount,
                status,
                receiptStatus: status as "approved" | "rejected",
                adminNote: note ?? p.adminNote,
                approvedAt: status === "approved" ? iso(new Date()) : p.approvedAt,
              }
            : p
        );
        const member = prev.members.find((m) => m.id === memberId);
        const approved = payments.find((p) => p.memberId === memberId && p.weekId === weekId);
        let nextState: ThriftState = { ...prev, payments };
        if (status === "rejected") {
          const weekDates = new Set((week?.days ?? []).map((d) => d.date));
          nextState = {
            ...nextState,
            savings: nextState.savings.filter(
              (s) => !(s.memberId === memberId && weekDates.has(s.date))
            ),
          };
        }
        return pushActivity(
          nextState,
          "hassana",
          status === "approved" ? "payment_approved" : "payment_rejected",
          `${member?.name ?? "Member"}’s Week ${week?.number ?? ""} payment was ${
            status === "approved" ? "approved" : "rejected"
          }`,
          approved?.amount
        );
      });
    },
    [pushActivity]
  );

  const approvePayment = React.useCallback(
    (memberId: string, weekId: string) => setPaymentStatus(memberId, weekId, "approved"),
    [setPaymentStatus]
  );

  const rejectPayment = React.useCallback(
    (memberId: string, weekId: string, note?: string) =>
      setPaymentStatus(memberId, weekId, "rejected", note),
    [setPaymentStatus]
  );

  const markPaidManually = React.useCallback(
    (memberId: string, weekId: string, customAmount?: number) => {
      setState((prev) => {
        if (!prev) return prev;
        const existing = prev.payments.find(
          (p) => p.memberId === memberId && p.weekId === weekId
        );
        const week = prev.weeks.find((w) => w.id === weekId);
        const plan = week ? getPlanForWeek(prev, memberId, week) : getMemberPlan(prev, memberId);
        const amount =
          customAmount || (week ? getWeeklyTarget(prev, memberId, week) : plan.dailyAmount * 5);
        const payment = existing
          ? { ...existing, amount, status: "approved" as const, method: "manual" as const, approvedAt: iso(new Date()), receiptStatus: "approved" as const }
          : {
              id: `${memberId}-${weekId}`,
              memberId,
              weekId,
              amount,
              status: "approved" as const,
              method: "manual" as const,
              receiptStatus: "approved" as const,
              createdAt: iso(new Date()),
              approvedAt: iso(new Date()),
            };
        const payments = existing
          ? prev.payments.map((p) => (p.id === payment.id ? payment : p))
          : [...prev.payments, payment];
        const member = prev.members.find((m) => m.id === memberId);
        const weekDays = week?.days ?? [];
        const weekDates = new Set(weekDays.map((d) => d.date));
        const alreadySaved = new Set(
          prev.savings.filter((s) => s.memberId === memberId && weekDates.has(s.date)).map((s) => s.date)
        );
        const missingDays = weekDays.filter((d) => !alreadySaved.has(d.date));
        const baseDaily = missingDays.length > 0 ? Math.floor(amount / missingDays.length) : 0;
        const remainder = amount - baseDaily * missingDays.length;
        const newSavings: DaySaving[] = missingDays.map((d, i) => ({
          id: `${memberId}-${d.date}`,
          memberId,
          weekId,
          date: d.date,
          amount: baseDaily + (i === missingDays.length - 1 ? remainder : 0),
        }));
        return pushActivity(
          { ...prev, payments, savings: [...prev.savings, ...newSavings] },
          "hassana",
          "payment_approved",
          `${member?.name ?? "Member"} confirmed Week ${week?.number ?? ""} as paid`,
          amount
        );
      });
    },
    [pushActivity]
  );

  const unmarkPaid = React.useCallback(
    (memberId: string, weekId: string) => {
      setState((prev) => {
        if (!prev) return prev;
        const target = prev.payments.find(
          (p) => p.memberId === memberId && p.weekId === weekId
        );
        if (!target || target.status !== "approved") return prev;
        const payments = prev.payments.map((p) =>
          p.memberId === memberId && p.weekId === weekId
            ? {
                ...p,
                status: "pending" as const,
                receiptStatus: p.receiptStatus === "approved" ? ("pending" as const) : p.receiptStatus,
                approvedAt: undefined,
              }
            : p
        );
        // Reverse the savings that marking this week paid created, so balances
        // and totals move hand-in-hand with the ledger.
        const week = prev.weeks.find((w) => w.id === weekId);
        const weekDates = new Set((week?.days ?? []).map((d) => d.date));
        const savings = prev.savings.filter(
          (s) => !(s.memberId === memberId && weekDates.has(s.date))
        );
        const member = prev.members.find((m) => m.id === memberId);
        return pushActivity(
          { ...prev, payments, savings },
          "hassana",
          "payment_rejected",
          `${member?.name ?? "Member"}’s Week ${week?.number ?? ""} was unmarked — back to pending`,
          target.amount
        );
      });
    },
    [pushActivity]
  );

  const changePlan = React.useCallback(
    (memberId: string, plan: ContributionPlan, scope: PlanChangeScope) => {
      let outstanding: number | undefined;
      setState((prev) => {
        if (!prev) return prev;
        const oldPlan = prev.memberPlans[memberId];
        const member = prev.members.find((m) => m.id === memberId);
        if (scope === "beginning" && oldPlan && member) {
          const transferred = getTotalTransferred(prev, memberId);
          const expected = prev.weeks
            .filter((w) => w.endDate < iso(new Date()))
            .reduce(
              (sum, w) =>
                sum + plan.dailyAmount * (member.daysPerWeek ?? w.days.length),
              0
            );
          outstanding = Math.max(0, expected - transferred);
        }
        const now = new Date();
        const currentWeek = getCurrentWeek(prev.weeks, now);
        const effectiveFrom =
          scope === "beginning"
            ? prev.settings.startDate
            : scope === "next-week"
              ? currentWeek
                ? iso(new Date(parseDay(currentWeek.startDate).getTime() + 7 * 86400000))
                : iso(now)
              : currentWeek
                ? currentWeek.startDate
                : iso(now);
        const event = {
          id: `plan-change-${Date.now()}`,
          plan,
          previousPlan: oldPlan,
          appliedAt: iso(now),
          effectiveFrom,
          scope,
          outstandingBalance: outstanding,
          note:
            scope === "beginning" && outstanding && outstanding > 0
              ? `Outstanding ${formatMoneyLabel(outstanding)} to be settled.`
              : undefined,
        };
        const next = {
          ...prev,
          memberPlans: { ...prev.memberPlans, [memberId]: plan },
          planHistory: {
            ...prev.planHistory,
            [memberId]: [...(prev.planHistory[memberId] ?? []), event],
          },
        };
        return pushActivity(
          resyncMemberWeeks(next, memberId),
          memberId,
          "plan_change",
          `${member?.name ?? "Member"} changed to ${plan.label}`,
          plan.dailyAmount
        );
      });
      return outstanding;
    },
    [pushActivity]
  );

  const addMember = React.useCallback(
    (input: { name: string; email?: string; plan: ContributionPlan; daysPerWeek?: number }) => {
      setState((prev) => {
        if (!prev) return prev;
        const baseId =
          input.name.trim().toLowerCase().replace(/\s+/g, "-") ||
          `member-${Date.now()}`;
        let id = baseId;
        let n = 2;
        while (prev.members.some((m) => m.id === id)) {
          id = `${baseId}-${n}`;
          n += 1;
        }
        const member: Member = {
          id,
          name: input.name.trim(),
          email: input.email,
          role: "member",
          color: AVATAR_COLORS[prev.members.length % AVATAR_COLORS.length],
          status: "active",
          joinedAt: iso(new Date()),
          daysPerWeek:
            input.daysPerWeek !== undefined
              ? Math.min(7, Math.max(1, Math.round(input.daysPerWeek)))
              : undefined,
        };
        return pushActivity(
          {
            ...prev,
            members: [...prev.members, member],
            memberPlans: { ...prev.memberPlans, [id]: input.plan },
          },
          "hassana",
          "member_joined",
          `${member.name} joined the family`
        );
      });
    },
    [pushActivity]
  );

  const updateMember = React.useCallback(
    (memberId: string, patch: { name?: string; email?: string; daysPerWeek?: number }) => {
      setState((prev) => {
        if (!prev) return prev;
        const members = prev.members.map((m) =>
          m.id === memberId
            ? {
                ...m,
                name: patch.name !== undefined && patch.name.trim() ? patch.name.trim() : m.name,
                email:
                  patch.email !== undefined
                    ? patch.email.trim()
                      ? patch.email.trim()
                      : undefined
                    : m.email,
                daysPerWeek:
                  patch.daysPerWeek !== undefined
                    ? Math.min(7, Math.max(1, Math.round(patch.daysPerWeek)))
                    : m.daysPerWeek,
              }
            : m
        );
        const updated = members.find((m) => m.id === memberId);
        const next = patch.daysPerWeek !== undefined
          ? resyncMemberWeeks({ ...prev, members }, memberId)
          : { ...prev, members };
        return pushActivity(
          next,
          memberId,
          "member_joined",
          `${updated?.name ?? "Member"}'s details were updated by the admin`
        );
      });
    },
    [pushActivity]
  );

  const assignAdmin = React.useCallback(
    (memberId: string) => {
      setState((prev) => {
        if (!prev) return prev;
        const target = prev.members.find((m) => m.id === memberId);
        if (!target || target.role === "admin") return prev;
        const members = prev.members.map((m) => {
          if (m.id === memberId) return { ...m, role: "admin" as const };
          if (m.role === "admin") return { ...m, role: "member" as const };
          return m;
        });
        return pushActivity(
          { ...prev, members },
          memberId,
          "member_joined",
          `${target.name} is now the admin`
        );
      });
    },
    [pushActivity]
  );

  const moveMember = React.useCallback((memberId: string, direction: "up" | "down") => {
    setState((prev) => {
      if (!prev) return prev;
      const index = prev.members.findIndex((m) => m.id === memberId);
      if (index < 0) return prev;
      const target = index + (direction === "up" ? -1 : 1);
      if (target < 0 || target >= prev.members.length) return prev;
      const members = [...prev.members];
      const [a] = members.splice(index, 1);
      members.splice(target, 0, a);
      return { ...prev, members };
    });
  }, []);

  const markNotificationsRead = React.useCallback(() => {
    setState((prev) => {
      if (!prev || !prev.notifications.some((n) => !n.read)) return prev;
      return { ...prev, notifications: prev.notifications.map((n) => ({ ...n, read: true })) };
    });
  }, []);

  const createThrift = React.useCallback((input: OnboardingInput) => {
    const members: Member[] = input.members.map((m, i) => ({
      id: m.name.trim().toLowerCase().replace(/\s+/g, "-") || `member-${i}`,
      name: m.name.trim(),
      email: m.email,
      role: i === 0 ? "admin" : m.role,
      color: AVATAR_COLORS[i % AVATAR_COLORS.length],
      status: "active",
      joinedAt: iso(new Date()),
    }));
    const creatorId = members[0].id;
    const settings: ThriftSettings = {
      name: input.name,
      startDate: input.startDate,
      vacationDate: input.vacationDate,
      workingDays: input.workingDays,
      defaultDailyAmount: input.defaultDailyAmount,
      paymentAccount: input.paymentAccount,
      currency: "NGN",
    };
    const thrift: ThriftState = {
      id: `thrift-${Date.now()}`,
      settings,
      members,
      memberPlans: Object.fromEntries(
        members.map((m) => [
          m.id,
          buildPlan(planKeyFromAmount(input.defaultDailyAmount), input.defaultDailyAmount),
        ])
      ),
      planHistory: {},
      weeks: [],
      savings: [],
      payments: [],
      activities: [
        {
          id: `act-welcome-${Date.now()}`,
          thriftId: `thrift-${Date.now()}`,
          actorId: creatorId,
          type: "member_joined",
          message: `${input.creatorName} created the ${input.name} thrift`,
          createdAt: iso(new Date()),
        },
      ],
      notifications: [],
      createdAt: iso(new Date()),
    };
    thrift.weeks = generateWeeks(settings);
    setState(thrift);

    // A fresh thrift is the end of a "start over" — allow demo re-seed again.
    try {
      window.localStorage.removeItem(CLEAR_FLAG_KEY);
    } catch {
      /* ignore */
    }

    // Link the signed-in email admin to the new admin member so their profile
    // resolves after onboarding. Name sign-in members don't need a profile row.
    if (getSupabaseMode() === "supabase") {
      void (async () => {
        try {
          const { getSupabaseClient } = await import("@/lib/supabase/client");
          const sb = getSupabaseClient();
          const { data } = await sb.auth.getUser();
          if (data?.user?.id) {
            await sb.from("profiles").upsert(
              {
                id: data.user.id,
                member_id: creatorId,
                email: data.user.email ?? "",
                display_name: members[0].name,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "id" }
            );
          }
        } catch {
          /* best effort */
        }
      })();
    }
  }, []);

  const updateSettings = React.useCallback((patch: Partial<ThriftSettings>) => {
    setState((prev) => {
      if (!prev) return prev;
      const settings = { ...prev.settings, ...patch };
      const weeks = generateWeeks(settings);
      return { ...prev, settings, weeks };
    });
  }, []);

  const resetThrift = React.useCallback(() => {
    const seeded = seedDemoState();
    setState(seeded.thrift);
  }, []);

  // Wipes all saved data so the app can start again from scratch (onboarding).
  const clearAll = React.useCallback(async () => {
    await repository.reset();
    try {
      window.localStorage.setItem(CLEAR_FLAG_KEY, "1");
    } catch {
      /* ignore */
    }
    setState(null);
  }, [repository]);

  return (
    <ThriftContext.Provider
      value={{
        state,
        isReady,
        isReloading,
        mode,
        memberLookup,
        recordSaving,
        uploadReceipt,
        approvePayment,
        rejectPayment,
        markPaidManually,
        unmarkPaid,
        changePlan,
        addMember,
        updateMember,
        moveMember,
        assignAdmin,
        markNotificationsRead,
        createThrift,
        updateSettings,
        resetThrift,
        clearAll,
      }}
    >
      {children}
    </ThriftContext.Provider>
  );
}

export function useThrift() {
  const ctx = React.useContext(ThriftContext);
  if (!ctx) throw new Error("useThrift must be used within ThriftProvider");
  return ctx;
}

function formatMoneyLabel(amount: number): string {
  return `₦${amount.toLocaleString("en-NG")}`;
}
