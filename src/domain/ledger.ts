import type { Member, ThriftState, ThriftWeek } from "@/domain/types";
import { getWeekStatus } from "@/domain/calendar";
import { getSavingsOn, getWeekPayment } from "@/domain/calculations";

// A contribution is a cell in the family ledger, just like a tick or a cross
// in a paper Ajo notebook. The ledger is the source of truth for the whole app.
export type LedgerStatus = "paid" | "partial" | "review" | "pending" | "missed" | "future";

// A week's status is DERIVED from how many of its contribution days are
// covered — never from the payment amount. A ₦2,100 receipt isn't "Week X
// paid for ₦2,100", it's "7 days covered", which may leave a week partially
// covered (🟡) until a later payment completes it.
export function getLedgerStatus(
  state: ThriftState,
  memberId: string,
  week: ThriftWeek,
  today: Date = new Date()
): LedgerStatus {
  const payment = getWeekPayment(state.payments, memberId, week.id);
  if (payment?.status === "pending" || payment?.status === "rejected") return "review";
  const coveredDays = week.days.filter((d) => getSavingsOn(state.savings, memberId, d.date) > 0).length;
  if (week.days.length > 0 && coveredDays >= week.days.length) return "paid";
  if (coveredDays > 0) return "partial";
  const status = getWeekStatus(week, today);
  if (status === "past") return "missed";
  if (status === "current") return "pending";
  return "future";
}

export interface LedgerRow {
  member: Member;
  cells: LedgerStatus[];
}

export interface LedgerData {
  weeks: ThriftWeek[];
  rows: LedgerRow[];
}

export function buildLedger(state: ThriftState, today: Date = new Date()): LedgerData {
  const members = state.members.filter((m) => m.status === "active");
  return {
    weeks: state.weeks,
    rows: members.map((member) => ({
      member,
      cells: state.weeks.map((week) => getLedgerStatus(state, member.id, week, today)),
    })),
  };
}

export const LEDGER_STATUS_META: Record<
  LedgerStatus,
  { label: string; symbol: string; className: string }
> = {
  paid: { label: "Paid", symbol: "✓", className: "text-success" },
  partial: { label: "Partially paid", symbol: "🟡", className: "text-warning" },
  review: { label: "Needs review", symbol: "⚠", className: "text-warning" },
  pending: { label: "Pending", symbol: "◷", className: "text-muted-foreground" },
  missed: { label: "Missed", symbol: "✕", className: "text-destructive" },
  future: { label: "Not yet due", symbol: "·", className: "text-muted-foreground/40" },
};
