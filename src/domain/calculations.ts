import type {
  ContributionPlan,
  DaySaving,
  Member,
  ThriftState,
  ThriftWeek,
  WeekPayment,
} from "@/domain/types";
import { getCurrentWeek, getWeekStatus, iso, parseDay } from "@/domain/calendar";

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

// Spreads a payment across the given week's working days ONLY. Each week is
// settled independently — money that exceeds a week's target never auto-covers
// the NEXT week's days. The admin decides when the next week is paid, and a
// week only becomes complete once ALL its working days (Mon–Fri) are covered.
//
// A day is ALWAYS worth the member's daily rate. The number of days a payment
// covers comes from the amount (₦1500 at ₦300/day = 5 days), never from a
// hand-picked day count — so a day can never show a split amount like ₦375 or
// ₦420.
export function spreadPayment(
  state: ThriftState,
  memberId: string,
  startWeekId: string,
  amount: number
): { weeks: PaymentSpreadWeek[]; savings: DaySaving[] } {
  if (amount <= 0) return { weeks: [], savings: state.savings };
  const startIndex = state.weeks.findIndex((w) => w.id === startWeekId);
  if (startIndex < 0) return { weeks: [], savings: state.savings };
  const week = state.weeks[startIndex];
  const plan = getPlanForWeek(state, memberId, week);
  const daily = plan.dailyAmount || 1;
  const dates = new Set(week.days.map((d) => d.date));
  const alreadySaved = new Set(
    state.savings
      .filter((s) => s.memberId === memberId && dates.has(s.date))
      .map((s) => s.date)
  );
  const missing = week.days.filter((d) => !alreadySaved.has(d.date));
  if (missing.length === 0) return { weeks: [], savings: state.savings };
  const totalDays = Math.max(1, Math.round(amount / daily));
  const covered = Math.min(missing.length, totalDays);
  const weekAmount = Math.round(daily * covered);
  const savings = fillWeekSavings(state, memberId, week.id, weekAmount, covered);
  return { weeks: [{ week, covered, amount: weekAmount }], savings };
}

// The day-by-day amount actually saved for a member across a week.
export function getWeekSavedTotal(savings: DaySaving[], memberId: string, weekId: string): number {
  return getWeekSavings(savings, memberId, weekId);
}

// Rebuilds a member's day-by-day savings (and their per-week payment records)
// from their uploaded/approved payments using rolling day coverage, so the
// ledger always matches what the member actually paid. Payment totals are
// preserved — money is never lost or re-valued by a plan/days change.
//
// Days that already equal the member's daily rate are kept (they may have been
// recorded by hand or auto-save, independent of a payment). Any day carrying a
// different amount is treated as corrupt and rebuilt from payments.
export function resyncMemberWeeks(state: ThriftState, memberId: string): ThriftState {
  const kept = state.savings.filter((s) => {
    if (s.memberId !== memberId) return true;
    const week = state.weeks.find((w) => w.id === s.weekId);
    const plan = week ? getPlanForWeek(state, memberId, week) : undefined;
    return Boolean(plan && plan.dailyAmount > 0 && s.amount === plan.dailyAmount);
  });
  let savings = kept;
  let payments = state.payments;

  // Days are allocated only once a payment is verified. Pending receipts are
  // preserved as records but don't fill the ledger until the admin approves.
  const coverage = state.payments
    .filter((p) => p.memberId === memberId && p.status === "approved" && (p.amount ?? 0) > 0)
    .map((p) => ({ p, idx: state.weeks.findIndex((w) => w.id === p.weekId) }))
    .filter((x) => x.idx >= 0)
    .sort(
      (a, b) =>
        a.idx - b.idx || String(a.p.createdAt ?? "").localeCompare(String(b.p.createdAt ?? ""))
    );

  const touched = new Map<string, WeekPayment>();
  for (const { p } of coverage) {
    const { weeks, savings: nextSavings } = spreadPayment(
      { ...state, savings },
      memberId,
      p.weekId,
      p.amount ?? 0
    );
    savings = nextSavings;
    for (const { week } of weeks) touched.set(week.id, p);
  }

  // Each covered week's record mirrors its day-sum; a week that received
  // overflow from an advance payment gets a record carrying the source
  // payment's status and receipt.
  for (const [weekId, source] of touched) {
    const amount = getWeekSavings(savings, memberId, weekId);
    const existing = payments.find((q) => q.memberId === memberId && q.weekId === weekId);
    const payment = existing
      ? { ...existing, amount }
      : {
          id: `${memberId}-${weekId}`,
          memberId,
          weekId,
          amount,
          status: source.status,
          method: source.method,
          receiptUrl: source.receiptUrl,
          receiptStatus: source.receiptStatus,
          createdAt: source.createdAt,
          approvedAt: source.approvedAt,
          paidAt: source.paidAt,
        };
    payments = existing
      ? payments.map((q) => (q.id === payment.id ? payment : q))
      : [...payments, payment];
  }

  return { ...state, payments, savings };
}

// True when any saved day's amount doesn't match the member's daily rate for
// that week — the signature of the old amount-splitting bugs (₦375/₦420 days).
export function needsDayRepair(state: ThriftState): boolean {
  for (const s of state.savings) {
    const week = state.weeks.find((w) => w.id === s.weekId);
    if (!week) continue;
    const plan = getPlanForWeek(state, s.memberId, week);
    if (plan.dailyAmount > 0 && s.amount !== plan.dailyAmount) return true;
  }
  return false;
}

export function resyncAllMembers(state: ThriftState): ThriftState {
  let next = state;
  for (const m of state.members) {
    next = resyncMemberWeeks(next, m.id);
  }
  return next;
}

// Allocates a verified payment across the earliest unpaid working days (rolling
// into following weeks) and keeps each covered week's payment record in sync
// with its day-sum. This is the single path used by auto-approval, manual
// approval, and "mark as paid" — a pending receipt never calls this.
export function applyPaymentAllocation(
  state: ThriftState,
  memberId: string,
  weekId: string,
  amount: number,
  status: "approved" | "pending",
  receiptUrl?: string
): { weeks: PaymentSpreadWeek[]; payments: WeekPayment[]; savings: DaySaving[] } {
  const { weeks, savings } = spreadPayment(state, memberId, weekId, amount);
  let payments = state.payments;
  for (const { week } of weeks) {
    const weekAmount = getWeekSavings(savings, memberId, week.id);
    const existing = payments.find((p) => p.memberId === memberId && p.weekId === week.id);
    const now = iso(new Date());
    const payment = existing
      ? {
          ...existing,
          amount: weekAmount,
          status,
          method: existing.method ?? ("transfer" as const),
          receiptUrl: receiptUrl ?? existing.receiptUrl,
          receiptStatus: status as "approved" | "pending",
          approvedAt: status === "approved" ? (existing.approvedAt ?? now) : existing.approvedAt,
        }
      : {
          id: `${memberId}-${week.id}`,
          memberId,
          weekId: week.id,
          amount: weekAmount,
          status,
          method: "transfer" as const,
          receiptUrl,
          receiptStatus: status as "approved" | "pending",
          approvedAt: status === "approved" ? now : undefined,
          createdAt: now,
        };
    payments = existing
      ? payments.map((p) => (p.id === payment.id ? payment : p))
      : [...payments, payment];
  }
  return { weeks, payments, savings };
}

// Records specific contribution DAYS (possibly spanning several weeks) as paid
// for a member — the manual, "back-fill the old weeks" path. Each selected day
// is worth exactly that week's daily rate; already-covered days are skipped.
// Every touched week gets an approved payment record whose amount mirrors its
// day-sum, so the ledger, totals and receipt list stay consistent.
export function recordDaysPaid(
  state: ThriftState,
  memberId: string,
  dates: string[]
): { savings: DaySaving[]; payments: WeekPayment[]; weekIds: string[] } {
  const weekByDate = new Map<string, ThriftWeek>();
  for (const w of state.weeks) {
    for (const d of w.days) weekByDate.set(d.date, w);
  }
  const alreadySaved = new Set(
    state.savings.filter((s) => s.memberId === memberId).map((s) => s.date)
  );

  let savings = state.savings;
  const touched = new Set<string>();
  for (const date of dates) {
    if (alreadySaved.has(date)) continue;
    const week = weekByDate.get(date);
    if (!week) continue;
    const plan = getPlanForWeek(state, memberId, week);
    if (plan.dailyAmount <= 0) continue;
    savings = [
      ...savings,
      { id: `${memberId}-${date}`, memberId, weekId: week.id, date, amount: plan.dailyAmount },
    ];
    alreadySaved.add(date);
    touched.add(week.id);
  }

  const now = iso(new Date());
  let payments = state.payments;
  for (const weekId of touched) {
    const total = getWeekSavings(savings, memberId, weekId);
    const existing = payments.find((p) => p.memberId === memberId && p.weekId === weekId);
    const payment = existing
      ? {
          ...existing,
          amount: total,
          status: "approved" as const,
          method: existing.method ?? ("manual" as const),
          receiptStatus: existing.receiptStatus === "pending" ? existing.receiptStatus : ("approved" as const),
          approvedAt: existing.approvedAt ?? now,
        }
      : {
          id: `${memberId}-${weekId}`,
          memberId,
          weekId,
          amount: total,
          status: "approved" as const,
          method: "manual" as const,
          receiptStatus: "approved" as const,
          approvedAt: now,
          createdAt: now,
        };
    payments = existing
      ? payments.map((p) => (p.id === payment.id ? payment : p))
      : [...payments, payment];
  }

  return { savings, payments, weekIds: [...touched] };
}
