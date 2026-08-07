import type { Member, ThriftState, ThriftWeek } from "@/domain/types";
import { getWeekStatus } from "@/domain/calendar";
import { getWeekPayment } from "@/domain/calculations";

// A contribution is a cell in the family ledger, just like a tick or a cross
// in a paper Ajo notebook. The ledger is the source of truth for the whole app.
export type LedgerStatus = "paid" | "review" | "pending" | "missed" | "future";

export function getLedgerStatus(
  state: ThriftState,
  memberId: string,
  week: ThriftWeek,
  today: Date = new Date()
): LedgerStatus {
  const payment = getWeekPayment(state.payments, memberId, week.id);
  if (payment?.status === "approved") return "paid";
  if (payment?.status === "rejected" || payment?.status === "pending") return "review";
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
  review: { label: "Needs review", symbol: "⚠", className: "text-warning" },
  pending: { label: "Pending", symbol: "◷", className: "text-muted-foreground" },
  missed: { label: "Missed", symbol: "✕", className: "text-destructive" },
  future: { label: "Not yet due", symbol: "·", className: "text-muted-foreground/40" },
};
