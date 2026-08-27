import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Member, ThriftState, ThriftWeek } from "@/domain/types";
import { getLedgerStatus, buildLedger, LEDGER_STATUS_META } from "@/domain/ledger";

function makeMember(id: string, overrides: Partial<Member> = {}): Member {
  return {
    id,
    name: `Member ${id}`,
    role: "member",
    color: "#16A34A",
    status: "active",
    joinedAt: "2026-01-01",
    ...overrides,
  };
}

function makeWeek(id: string, startDate: string, dayDates: string[]): ThriftWeek {
  return {
    id,
    number: parseInt(id.replace("week-", "")),
    startDate,
    endDate: dayDates[dayDates.length - 1],
    days: dayDates.map((date, i) => ({ date, index: i })),
  };
}

function makeState(overrides: Partial<ThriftState> = {}): ThriftState {
  return {
    id: "thrift-1",
    settings: {
      name: "Test",
      startDate: "2026-01-05",
      vacationDate: "2026-04-30",
      workingDays: [1, 2, 3, 4, 5],
      defaultDailyAmount: 200,
      paymentAccount: { bank: "Test", accountName: "Test", accountNumber: "123" },
      currency: "NGN",
    },
    members: [],
    memberPlans: {},
    planHistory: {},
    weeks: [],
    savings: [],
    payments: [],
    activities: [],
    notifications: [],
    createdAt: "2026-01-01",
    ...overrides,
  };
}

describe("getLedgerStatus", () => {
  const week = makeWeek("w1", "2026-01-05", ["2026-01-05", "2026-01-06", "2026-01-07", "2026-01-08", "2026-01-09"]);

  it("returns 'paid' when all days have savings", () => {
    const state = makeState({
      members: [makeMember("m1")],
      memberPlans: { m1: { key: "one-hand", label: "One Hand", dailyAmount: 200, weeklyAmount: 1000, monthlyAmount: 4000 } },
      weeks: [week],
      savings: [
        { id: "s1", memberId: "m1", weekId: "w1", date: "2026-01-05", amount: 200 },
        { id: "s2", memberId: "m1", weekId: "w1", date: "2026-01-06", amount: 200 },
        { id: "s3", memberId: "m1", weekId: "w1", date: "2026-01-07", amount: 200 },
        { id: "s4", memberId: "m1", weekId: "w1", date: "2026-01-08", amount: 200 },
        { id: "s5", memberId: "m1", weekId: "w1", date: "2026-01-09", amount: 200 },
      ],
    });
    expect(getLedgerStatus(state, "m1", week)).toBe("paid");
  });

  it("returns 'partial' when some days have savings", () => {
    const state = makeState({
      members: [makeMember("m1")],
      memberPlans: { m1: { key: "one-hand", label: "One Hand", dailyAmount: 200, weeklyAmount: 1000, monthlyAmount: 4000 } },
      weeks: [week],
      savings: [
        { id: "s1", memberId: "m1", weekId: "w1", date: "2026-01-05", amount: 200 },
        { id: "s2", memberId: "m1", weekId: "w1", date: "2026-01-06", amount: 200 },
      ],
    });
    expect(getLedgerStatus(state, "m1", week)).toBe("partial");
  });

  it("returns 'review' when payment is pending", () => {
    const state = makeState({
      members: [makeMember("m1")],
      memberPlans: { m1: { key: "one-hand", label: "One Hand", dailyAmount: 200, weeklyAmount: 1000, monthlyAmount: 4000 } },
      weeks: [week],
      payments: [{
        id: "p1", memberId: "m1", weekId: "w1", amount: 1000, status: "pending",
        method: "transfer", createdAt: "2026-01-05T10:00:00Z",
      }],
    });
    expect(getLedgerStatus(state, "m1", week)).toBe("review");
  });

  it("returns 'review' when payment is rejected", () => {
    const state = makeState({
      members: [makeMember("m1")],
      memberPlans: { m1: { key: "one-hand", label: "One Hand", dailyAmount: 200, weeklyAmount: 1000, monthlyAmount: 4000 } },
      weeks: [week],
      payments: [{
        id: "p1", memberId: "m1", weekId: "w1", amount: 1000, status: "rejected",
        method: "transfer", createdAt: "2026-01-05T10:00:00Z",
      }],
    });
    expect(getLedgerStatus(state, "m1", week)).toBe("review");
  });

  it("returns 'missed' for past week with no savings", () => {
    const state = makeState({
      members: [makeMember("m1")],
      weeks: [week],
    });
    // Today is after the week
    expect(getLedgerStatus(state, "m1", week, new Date(2026, 0, 12))).toBe("missed");
  });

  it("returns 'pending' for current week with no savings", () => {
    const state = makeState({
      members: [makeMember("m1")],
      weeks: [week],
    });
    // Today is within the week
    expect(getLedgerStatus(state, "m1", week, new Date(2026, 0, 7))).toBe("pending");
  });

  it("returns 'future' for upcoming week", () => {
    const state = makeState({
      members: [makeMember("m1")],
      weeks: [week],
    });
    // Today is before the week
    expect(getLedgerStatus(state, "m1", week, new Date(2026, 0, 1))).toBe("future");
  });
});

describe("buildLedger", () => {
  it("builds a ledger for active members only", () => {
    const w1 = makeWeek("w1", "2026-01-05", ["2026-01-05"]);
    const state = makeState({
      members: [
        makeMember("m1"),
        makeMember("m2", { status: "suspended" }),
        makeMember("m3"),
      ],
      weeks: [w1],
    });
    const ledger = buildLedger(state, new Date(2026, 0, 12));
    expect(ledger.rows).toHaveLength(2);
    expect(ledger.rows.map((r) => r.member.id)).toEqual(["m1", "m3"]);
  });

  it("includes all weeks", () => {
    const w1 = makeWeek("w1", "2026-01-05", ["2026-01-05"]);
    const w2 = makeWeek("w2", "2026-01-12", ["2026-01-12"]);
    const state = makeState({
      members: [makeMember("m1")],
      weeks: [w1, w2],
    });
    const ledger = buildLedger(state, new Date(2026, 0, 19));
    expect(ledger.weeks).toHaveLength(2);
    expect(ledger.rows[0].cells).toHaveLength(2);
  });
});

describe("LEDGER_STATUS_META", () => {
  it("has metadata for all ledger statuses", () => {
    const statuses = ["paid", "partial", "review", "pending", "missed", "future"] as const;
    for (const status of statuses) {
      expect(LEDGER_STATUS_META[status]).toBeDefined();
      expect(LEDGER_STATUS_META[status].label).toBeTruthy();
      expect(LEDGER_STATUS_META[status].symbol).toBeTruthy();
      expect(LEDGER_STATUS_META[status].className).toBeTruthy();
    }
  });
});
