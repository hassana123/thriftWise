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
  const days = member?.daysPerWeek ?? week.days.length;
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

// Recalculates a member's recorded payment amounts and day-by-day savings for
// every week that already has a payment record, so tables, balances, and the
// ledger stay in sync after plan or days-per-week changes. Honors plan-change
// history (getWeeklyTarget → getPlanForWeek), so "today"/"next-week" changes
// leave earlier weeks at their previous plan while "beginning" backdates them.
export function resyncMemberWeeks(state: ThriftState, memberId: string): ThriftState {
  let payments = state.payments;
  let savings = state.savings;
  for (const w of state.weeks) {
    const existing = payments.find((p) => p.memberId === memberId && p.weekId === w.id);
    if (!existing) continue;
    const target = getWeeklyTarget(state, memberId, w);
    payments = payments.map((p) => (p.id === existing.id ? { ...p, amount: target } : p));
    const dates = new Set(w.days.map((d) => d.date));
    savings = savings.filter((s) => !(s.memberId === memberId && dates.has(s.date)));
    savings = fillWeekSavings({ ...state, payments, savings }, memberId, w.id, target);
  }
  return { ...state, payments, savings };
}
