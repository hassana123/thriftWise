import type {
  ContributionPlan,
  DaySaving,
  Member,
  ThriftState,
  ThriftWeek,
  WeekPayment,
} from "@/domain/types";
import { getCurrentWeek, getWeekStatus, parseDay } from "@/domain/calendar";

export function getMemberPlan(state: ThriftState, memberId: string) {
  return state.memberPlans[memberId] ?? state.memberPlans[state.members[0]?.id ?? ""];
}

// Returns the contribution plan that applied for a given week, honouring the
// plan-change history. A change scoped "today"/"next-week" only affects the
// week it starts from onwards; past weeks keep their original plan. A change
// scoped "beginning" applies to every week.
export function getPlanForWeek(
  state: ThriftState,
  memberId: string,
  week: ThriftWeek
): ContributionPlan {
  const events = (state.planHistory[memberId] ?? [])
    .map((e) => ({
      plan: e.plan,
      previousPlan: e.previousPlan,
      effectiveFrom: e.effectiveFrom ? parseDay(e.effectiveFrom) : new Date(NaN),
    }))
    .filter((e) => !Number.isNaN(e.effectiveFrom.getTime()))
    .sort((a, b) => a.effectiveFrom.getTime() - b.effectiveFrom.getTime());
  if (events.length === 0) return getMemberPlan(state, memberId);
  const weekStart = parseDay(week.startDate).getTime();
  let applied: ContributionPlan | null = null;
  for (const e of events) {
    if (e.effectiveFrom.getTime() <= weekStart) applied = e.plan;
    else break;
  }
  if (applied) return applied;
  return events[0].previousPlan ?? getMemberPlan(state, memberId);
}

export function getWeeklyTarget(state: ThriftState, memberId: string, week: ThriftWeek) {
  const plan = getPlanForWeek(state, memberId, week);
  const member = state.members.find((m) => m.id === memberId);
  // A week physically only has the group's working days. If a member commits to
  // more days than that (e.g. 7), the overflow pre-pays the NEXT week's working
  // days — it never covers weekends. Cap the per-week target at the week's days.
  const days = Math.min(member?.daysPerWeek ?? week.days.length, week.days.length);
  return plan.dailyAmount * days;
}

export function getWeekSavings(
  savings: DaySaving[],
  memberId: string,
  weekId: string
): number {
  return savings
    .filter((s) => s.memberId === memberId && s.weekId === weekId)
    .reduce((sum, s) => sum + s.amount, 0);
}

export function getSavingsOn(
  savings: DaySaving[],
  memberId: string,
  date: string
): number {
  const found = savings.find((s) => s.memberId === memberId && s.date === date);
  return found?.amount ?? 0;
}

export function getWeekPayment(
  payments: WeekPayment[],
  memberId: string,
  weekId: string
): WeekPayment | undefined {
  return payments.find((p) => p.memberId === memberId && p.weekId === weekId);
}

export function getTotalSaved(state: ThriftState, memberId: string): number {
  return state.savings
    .filter((s) => s.memberId === memberId)
    .reduce((sum, s) => sum + s.amount, 0);
}

export function getTotalTransferred(state: ThriftState, memberId: string): number {
  return state.payments
    .filter((p) => p.memberId === memberId && p.status === "approved")
    .reduce((sum, p) => sum + p.amount, 0);
}

export function getMemberBalance(state: ThriftState, memberId: string): number {
  return getTotalSaved(state, memberId);
}

export function getFamilySavings(state: ThriftState): number {
  return state.savings.reduce((sum, s) => sum + s.amount, 0);
}

// Total target for the whole family across the entire thrift, using each
// member's own plan for each week (honouring plan-change history).
export function getFamilyGoal(state: ThriftState): number {
  return state.weeks.reduce(
    (sum, w) =>
      sum +
      state.members
        .filter((m) => m.status !== "suspended")
        .reduce((inner, m) => inner + getWeeklyTarget(state, m.id, w), 0),
    0
  );
}

export function getFamilyTransferred(state: ThriftState): number {
  return state.payments
    .filter((p) => p.status === "approved")
    .reduce((sum, p) => sum + p.amount, 0);
}

export function getOutstandingBalance(state: ThriftState, memberId: string): number {
  const transferred = getTotalTransferred(state, memberId);
  const expected = state.weeks
    .filter((w) => getWeekStatus(w) === "past")
    .reduce((sum, w) => sum + getWeeklyTarget(state, memberId, w), 0);
  return Math.max(0, expected - transferred);
}

export function getFamilyRanking(state: ThriftState): Member[] {
  return [...state.members].sort((a, b) => getTotalSaved(state, b.id) - getTotalSaved(state, a.id));
}

export function getWeekProgress(
  state: ThriftState,
  memberId: string,
  week: ThriftWeek
): number {
  const target = getWeeklyTarget(state, memberId, week);
  if (target <= 0) return 0;
  const saved = getWeekSavings(state.savings, memberId, week.id);
  return Math.min(100, Math.round((saved / target) * 100));
}

export function getMemberCompletion(
  state: ThriftState,
  memberId: string,
  today: Date = new Date()
): number {
  const relevant = state.weeks.filter((w) => getWeekStatus(w, today) !== "upcoming");
  if (relevant.length === 0) return 0;
  const paid = relevant.filter(
    (w) => getWeekPayment(state.payments, memberId, w.id)?.status === "approved"
  ).length;
  return Math.min(100, Math.round((paid / relevant.length) * 100));
}

export function getCollectionRate(
  state: ThriftState,
  memberId?: string,
  today: Date = new Date()
): number {
  const relevant = state.weeks.filter((w) => getWeekStatus(w, today) !== "upcoming");
  const members = memberId
    ? state.members.filter((m) => m.id === memberId)
    : state.members.filter((m) => m.status !== "suspended");
  const expected = relevant.reduce(
    (sum, w) => sum + members.reduce((inner, m) => inner + getWeeklyTarget(state, m.id, w), 0),
    0
  );
  const actual = state.payments
    .filter((p) => p.status === "approved" && (!memberId || p.memberId === memberId))
    .reduce((sum, p) => sum + p.amount, 0);
  if (expected <= 0) return 0;
  return Math.min(100, Math.round((actual / expected) * 100));
}

export function getElapsedWeekCount(state: ThriftState, today: Date = new Date()): number {
  return state.weeks.filter((w) => getWeekStatus(w, today) !== "upcoming").length;
}

// Fills unrecorded working days of a week with savings, spreading `amount`
// across them. Used when a week is settled so the day-by-day ledger matches
// reality. `maxDays` limits how many days get filled (e.g. paying 7 days means
// 5 days of this week plus 2 days of the next week).
export function fillWeekSavings(
  state: ThriftState,
  memberId: string,
  weekId: string,
  amount: number,
  maxDays?: number
): DaySaving[] {
  if (amount <= 0) return state.savings;
  const week = state.weeks.find((w) => w.id === weekId);
  if (!week) return state.savings;
  const dates = new Set(week.days.map((d) => d.date));
  const alreadySaved = new Set(
    state.savings
      .filter((s) => s.memberId === memberId && dates.has(s.date))
      .map((s) => s.date)
  );
  const missing = week.days.filter((d) => !alreadySaved.has(d.date));
  if (missing.length === 0) return state.savings;
  const toFill = maxDays !== undefined ? missing.slice(0, maxDays) : missing;
  if (toFill.length === 0) return state.savings;
  const base = Math.floor(amount / toFill.length);
  const remainder = amount - base * toFill.length;
  const extra: DaySaving[] = toFill.map((d, i) => ({
    id: `${memberId}-${d.date}`,
    memberId,
    weekId,
    date: d.date,
    amount: base + (i === toFill.length - 1 ? remainder : 0),
  }));
  return [...state.savings, ...extra];
}

export function getExpectedSavingsToDate(state: ThriftState, memberId: string): number {
  const currentWeek = getCurrentWeek(state.weeks);
  return state.weeks
    .filter((w) => {
      const status = getWeekStatus(w);
      return status === "past" || (currentWeek !== null && w.id === currentWeek.id);
    })
    .reduce((sum, w) => sum + getWeeklyTarget(state, memberId, w), 0);
}

export interface PaymentSpreadWeek {
  week: ThriftWeek;
  covered: number;
  amount: number;
}

// Spreads a payment across consecutive WORKING days, rolling into following
// weeks. 7 days means Mon–Fri of this week plus Mon–Tue of the next week —
// weekends are never counted. Only days that don't already have savings are
// filled, so pre-paid days (from an earlier payment's overflow) roll forward
// instead of being double-counted.
export function spreadPayment(
  state: ThriftState,
  memberId: string,
  startWeekId: string,
  amount: number,
  daysCovered?: number
): { weeks: PaymentSpreadWeek[]; savings: DaySaving[] } {
  if (amount <= 0) return { weeks: [], savings: state.savings };
  const startIndex = state.weeks.findIndex((w) => w.id === startWeekId);
  if (startIndex < 0) return { weeks: [], savings: state.savings };
  const startWeek = state.weeks[startIndex];
  const plan = getPlanForWeek(state, memberId, startWeek);
  const defaultDays = startWeek.days.length || 5;
  const totalDays =
    daysCovered && daysCovered > 0
      ? Math.floor(daysCovered)
      : Math.max(1, Math.round(amount / (plan.dailyAmount || 1)));
  const perDay = amount / totalDays;
  let savings = state.savings;
  let remainingDays = totalDays;
  let remainingAmount = amount;
  const weeks: PaymentSpreadWeek[] = [];
  let i = startIndex;
  while (remainingDays > 0 && i < state.weeks.length) {
    const week = state.weeks[i];
    const dates = new Set(week.days.map((d) => d.date));
    const alreadySaved = new Set(
      savings
        .filter((s) => s.memberId === memberId && dates.has(s.date))
        .map((s) => s.date)
    );
    const missing = week.days.filter((d) => !alreadySaved.has(d.date));
    const covered = Math.min(remainingDays, missing.length);
    if (covered <= 0) {
      i += 1;
      continue;
    }
    const weekAmount =
      i === state.weeks.length - 1 ? remainingAmount : Math.round(perDay * covered);
    weeks.push({ week, covered, amount: weekAmount });
    savings = fillWeekSavings({ ...state, savings }, memberId, week.id, weekAmount, covered);
    remainingDays -= covered;
    remainingAmount -= weekAmount;
    i += 1;
  }
  return { weeks, savings };
}

// The day-by-day amount actually saved for a member across a week.
export function getWeekSavedTotal(savings: DaySaving[], memberId: string, weekId: string): number {
  return getWeekSavings(savings, memberId, weekId);
}

// Rebuilds a member's day-by-day savings (and their per-week payment records)
// from their approved payments using rolling day coverage, so the ledger always
// matches what the member actually paid. Payment totals are preserved — money
// is never lost or re-valued by a plan/days change.
export function resyncMemberWeeks(state: ThriftState, memberId: string): ThriftState {
  let savings = state.savings.filter((s) => s.memberId !== memberId);
  let payments = state.payments.filter((p) => p.memberId !== memberId);

  const approved = state.payments
    .filter((p) => p.memberId === memberId && p.status === "approved" && (p.amount ?? 0) > 0)
    .map((p) => ({ p, idx: state.weeks.findIndex((w) => w.id === p.weekId) }))
    .filter((x) => x.idx >= 0)
    .sort(
      (a, b) =>
        a.idx - b.idx || String(a.p.createdAt ?? "").localeCompare(String(b.p.createdAt ?? ""))
    );

  for (const { p } of approved) {
    const { weeks, savings: nextSavings } = spreadPayment(
      { ...state, savings, payments },
      memberId,
      p.weekId,
      p.amount ?? 0
    );
    savings = nextSavings;
    // A week's payment amount mirrors the total days covered inside it (its
    // day-sum), so records stay consistent with the day-by-day ledger across
    // week boundaries — overflow from an earlier payment is never lost.
    for (const { week } of weeks) {
      const amount = getWeekSavings(savings, memberId, week.id);
      const existing = payments.find((q) => q.memberId === memberId && q.weekId === week.id);
      const payment = existing
        ? { ...existing, amount }
        : {
            id: `${memberId}-${week.id}`,
            memberId,
            weekId: week.id,
            amount,
            status: "approved" as const,
            method: "manual" as const,
            receiptStatus: "approved" as const,
            createdAt: p.createdAt,
            approvedAt: p.approvedAt,
          };
      payments = existing
        ? payments.map((q) => (q.id === payment.id ? payment : q))
        : [...payments, payment];
    }
  }

  return { ...state, payments, savings };
}
