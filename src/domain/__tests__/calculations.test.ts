import { describe, it, expect } from "vitest";
import type { Member, ThriftState, ThriftWeek, DaySaving, WeekPayment, ContributionPlan } from "@/domain/types";
import {
  getMemberPlan,
  getPlanForWeek,
  getWeeklyTarget,
  getWeekSavings,
  getSavingsOn,
  getWeekPayment,
  getTotalSaved,
  getTotalTransferred,
  getMemberBalance,
  getFamilySavings,
  getFamilyGoal,
  getFamilyTransferred,
  getOutstandingBalance,
  getFirstUnpaidWeek,
  getFamilyRanking,
  getWeekProgress,
  getMemberCompletion,
  getCollectionRate,
  getElapsedWeekCount,
  fillWeekSavings,
  getExpectedSavingsToDate,
  spreadPayment,
  planDayCoverage,
  recordDaysPaid,
  unmarkDays,
  needsDayRepair,
  resyncMemberWeeks,
} from "@/domain/calculations";

// ── Test Helpers ──────────────────────────────────────────────────

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

function makePlan(dailyAmount = 200): ContributionPlan {
  return {
    key: "one-hand",
    label: "One Hand",
    dailyAmount,
    weeklyAmount: dailyAmount * 5,
    monthlyAmount: dailyAmount * 5 * 4,
  };
}

function makeWeek(id: string, number: number, startDate: string, days: string[]): ThriftWeek {
  return {
    id,
    number,
    startDate,
    endDate: days[days.length - 1],
    days: days.map((date, i) => ({ date, index: i })),
  };
}

function makeSaving(memberId: string, weekId: string, date: string, amount: number): DaySaving {
  return { id: `${memberId}-${date}`, memberId, weekId, date, amount };
}

function makePayment(memberId: string, weekId: string, amount: number, status: WeekPayment["status"] = "approved"): WeekPayment {
  return {
    id: `${memberId}-${weekId}`,
    memberId,
    weekId,
    amount,
    status,
    method: "transfer",
    createdAt: "2026-01-05T10:00:00Z",
  };
}

function makeState(overrides: Partial<ThriftState> = {}): ThriftState {
  return {
    id: "thrift-1",
    settings: {
      name: "Family Thrift",
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

// ── getMemberPlan ─────────────────────────────────────────────────

describe("getMemberPlan", () => {
  it("returns the member's own plan", () => {
    const plan = makePlan(300);
    const state = makeState({ memberPlans: { m1: plan } });
    expect(getMemberPlan(state, "m1")).toBe(plan);
  });

  it("falls back to the first member's plan when member has no plan", () => {
    const plan = makePlan(400);
    const state = makeState({
      members: [makeMember("m1")],
      memberPlans: { m1: plan },
    });
    expect(getMemberPlan(state, "m2")).toBe(plan);
  });

  it("returns undefined when no plans exist", () => {
    const state = makeState();
    expect(getMemberPlan(state, "m1")).toBeUndefined();
  });
});

// ── getWeeklyTarget ───────────────────────────────────────────────

describe("getWeeklyTarget", () => {
  it("calculates target as dailyAmount * daysInWeek", () => {
    const week = makeWeek("w1", 1, "2026-01-05", ["2026-01-05", "2026-01-06", "2026-01-07", "2026-01-08", "2026-01-09"]);
    const state = makeState({
      members: [makeMember("m1")],
      memberPlans: { m1: makePlan(200) },
      weeks: [week],
    });
    expect(getWeeklyTarget(state, "m1", week)).toBe(1000);
  });

  it("caps target at week's days when member.daysPerWeek exceeds week days", () => {
    const week = makeWeek("w1", 1, "2026-01-05", ["2026-01-05", "2026-01-06", "2026-01-07"]);
    const state = makeState({
      members: [makeMember("m1", { daysPerWeek: 7 })],
      memberPlans: { m1: makePlan(300) },
      weeks: [week],
    });
    // 300 * min(7, 3) = 300 * 3 = 900
    expect(getWeeklyTarget(state, "m1", week)).toBe(900);
  });
});

// ── getWeekSavings / getSavingsOn ─────────────────────────────────

describe("getWeekSavings", () => {
  it("sums savings for a member in a specific week", () => {
    const savings = [
      makeSaving("m1", "w1", "2026-01-05", 200),
      makeSaving("m1", "w1", "2026-01-06", 200),
    ];
    expect(getWeekSavings(savings, "m1", "w1")).toBe(400);
  });

  it("returns 0 when no savings exist", () => {
    expect(getWeekSavings([], "m1", "w1")).toBe(0);
  });

  it("filters by both memberId and weekId", () => {
    const savings = [
      makeSaving("m1", "w1", "2026-01-05", 200),
      makeSaving("m2", "w1", "2026-01-05", 300),
      makeSaving("m1", "w2", "2026-01-12", 200),
    ];
    expect(getWeekSavings(savings, "m1", "w1")).toBe(200);
  });
});

describe("getSavingsOn", () => {
  it("returns the amount saved on a specific date", () => {
    const savings = [makeSaving("m1", "w1", "2026-01-05", 200)];
    expect(getSavingsOn(savings, "m1", "2026-01-05")).toBe(200);
  });

  it("returns 0 when no saving exists", () => {
    expect(getSavingsOn([], "m1", "2026-01-05")).toBe(0);
  });
});

// ── getWeekPayment ────────────────────────────────────────────────

describe("getWeekPayment", () => {
  it("finds payment by memberId and weekId", () => {
    const payment = makePayment("m1", "w1", 1000);
    expect(getWeekPayment([payment], "m1", "w1")).toBe(payment);
  });

  it("returns undefined when no payment matches", () => {
    expect(getWeekPayment([], "m1", "w1")).toBeUndefined();
  });
});

// ── getTotalSaved / getTotalTransferred / getMemberBalance ────────

describe("getTotalSaved", () => {
  it("sums all savings for a member", () => {
    const state = makeState({
      savings: [
        makeSaving("m1", "w1", "2026-01-05", 200),
        makeSaving("m1", "w1", "2026-01-06", 200),
        makeSaving("m2", "w1", "2026-01-05", 300),
      ],
    });
    expect(getTotalSaved(state, "m1")).toBe(400);
  });
});

describe("getTotalTransferred", () => {
  it("sums only approved payments", () => {
    const state = makeState({
      payments: [
        makePayment("m1", "w1", 1000, "approved"),
        makePayment("m1", "w2", 500, "pending"),
        makePayment("m2", "w1", 800, "approved"),
      ],
    });
    expect(getTotalTransferred(state, "m1")).toBe(1000);
  });
});

describe("getMemberBalance", () => {
  it("equals getTotalSaved", () => {
    const state = makeState({
      savings: [makeSaving("m1", "w1", "2026-01-05", 200)],
    });
    expect(getMemberBalance(state, "m1")).toBe(200);
  });
});

// ── getFamilySavings / getFamilyGoal / getFamilyTransferred ───────

describe("getFamilySavings", () => {
  it("sums all savings across all members", () => {
    const state = makeState({
      savings: [
        makeSaving("m1", "w1", "2026-01-05", 200),
        makeSaving("m2", "w1", "2026-01-05", 300),
      ],
    });
    expect(getFamilySavings(state)).toBe(500);
  });
});

describe("getFamilyTransferred", () => {
  it("sums all approved payments across members", () => {
    const state = makeState({
      payments: [
        makePayment("m1", "w1", 1000, "approved"),
        makePayment("m2", "w1", 800, "approved"),
        makePayment("m1", "w2", 500, "pending"),
      ],
    });
    expect(getFamilyTransferred(state)).toBe(1800);
  });
});

// ── getOutstandingBalance ─────────────────────────────────────────

describe("getOutstandingBalance", () => {
  it("returns expected minus transferred for past weeks", () => {
    const week = makeWeek("w1", 1, "2026-01-05", ["2026-01-05", "2026-01-06", "2026-01-07", "2026-01-08", "2026-01-09"]);
    const state = makeState({
      members: [makeMember("m1")],
      memberPlans: { m1: makePlan(200) },
      weeks: [week],
      payments: [makePayment("m1", "w1", 400, "approved")],
    });
    // 5 * 200 = 1000 target, 400 transferred => 600 outstanding
    expect(getOutstandingBalance(state, "m1")).toBe(600);
  });

  it("returns 0 when fully paid", () => {
    const week = makeWeek("w1", 1, "2026-01-05", ["2026-01-05", "2026-01-06", "2026-01-07", "2026-01-08", "2026-01-09"]);
    const state = makeState({
      members: [makeMember("m1")],
      memberPlans: { m1: makePlan(200) },
      weeks: [week],
      payments: [makePayment("m1", "w1", 1000, "approved")],
    });
    expect(getOutstandingBalance(state, "m1")).toBe(0);
  });
});

// ── getFirstUnpaidWeek ────────────────────────────────────────────

describe("getFirstUnpaidWeek", () => {
  it("returns the first past week with insufficient savings", () => {
    const w1 = makeWeek("w1", 1, "2026-01-05", ["2026-01-05", "2026-01-06"]);
    const w2 = makeWeek("w2", 2, "2026-01-12", ["2026-01-12", "2026-01-13"]);
    const state = makeState({
      members: [makeMember("m1")],
      memberPlans: { m1: makePlan(200) },
      weeks: [w1, w2],
      savings: [makeSaving("m1", "w1", "2026-01-05", 200)], // only 1 of 2 days in w1
    });
    // Today is after w1, w1 is past and has only 200/400
    const today = new Date(2026, 0, 19); // Monday of week 3
    expect(getFirstUnpaidWeek(state, "m1", today)?.id).toBe("w1");
  });

  it("returns null when all weeks are paid", () => {
    const w1 = makeWeek("w1", 1, "2026-01-05", ["2026-01-05"]);
    const state = makeState({
      members: [makeMember("m1")],
      memberPlans: { m1: makePlan(200) },
      weeks: [w1],
      savings: [makeSaving("m1", "w1", "2026-01-05", 200)],
    });
    const today = new Date(2026, 0, 12);
    expect(getFirstUnpaidWeek(state, "m1", today)).toBeNull();
  });
});

// ── getFamilyRanking ──────────────────────────────────────────────

describe("getFamilyRanking", () => {
  it("sorts members by total saved descending", () => {
    const state = makeState({
      members: [makeMember("m1"), makeMember("m2"), makeMember("m3")],
      savings: [
        makeSaving("m2", "w1", "2026-01-05", 600),
        makeSaving("m1", "w1", "2026-01-05", 400),
        makeSaving("m3", "w1", "2026-01-05", 200),
      ],
    });
    const ranking = getFamilyRanking(state);
    expect(ranking.map((m) => m.id)).toEqual(["m2", "m1", "m3"]);
  });
});

// ── getWeekProgress ───────────────────────────────────────────────

describe("getWeekProgress", () => {
  it("returns percentage of week target saved", () => {
    const week = makeWeek("w1", 1, "2026-01-05", ["2026-01-05", "2026-01-06", "2026-01-07", "2026-01-08", "2026-01-09"]);
    const state = makeState({
      members: [makeMember("m1")],
      memberPlans: { m1: makePlan(200) },
      weeks: [week],
      savings: [makeSaving("m1", "w1", "2026-01-05", 200), makeSaving("m1", "w1", "2026-01-06", 200)],
    });
    // 400/1000 = 40%
    expect(getWeekProgress(state, "m1", week)).toBe(40);
  });

  it("caps at 100%", () => {
    const week = makeWeek("w1", 1, "2026-01-05", ["2026-01-05"]);
    const state = makeState({
      members: [makeMember("m1")],
      memberPlans: { m1: makePlan(200) },
      weeks: [week],
      savings: [makeSaving("m1", "w1", "2026-01-05", 400)], // overpaid
    });
    expect(getWeekProgress(state, "m1", week)).toBe(100);
  });

  it("returns 0 when target is 0", () => {
    const week = makeWeek("w1", 1, "2026-01-05", []);
    const state = makeState({
      members: [makeMember("m1")],
      memberPlans: { m1: makePlan(200) },
      weeks: [week],
    });
    expect(getWeekProgress(state, "m1", week)).toBe(0);
  });
});

// ── getMemberCompletion ───────────────────────────────────────────

describe("getMemberCompletion", () => {
  it("returns percentage of non-upcoming weeks with approved payments", () => {
    const w1 = makeWeek("w1", 1, "2026-01-05", ["2026-01-05"]);
    const w2 = makeWeek("w2", 2, "2026-01-12", ["2026-01-12"]);
    const state = makeState({
      members: [makeMember("m1")],
      memberPlans: { m1: makePlan(200) },
      weeks: [w1, w2],
      payments: [makePayment("m1", "w1", 200, "approved")],
    });
    // w1 is past (approved), w2 is past (no payment) => 1/2 = 50%
    expect(getMemberCompletion(state, "m1", new Date(2026, 0, 19))).toBe(50);
  });
});

// ── getCollectionRate ─────────────────────────────────────────────

describe("getCollectionRate", () => {
  it("returns approved payments / expected target for past weeks", () => {
    const w1 = makeWeek("w1", 1, "2026-01-05", ["2026-01-05", "2026-01-06"]);
    const state = makeState({
      members: [makeMember("m1")],
      memberPlans: { m1: makePlan(200) },
      weeks: [w1],
      payments: [makePayment("m1", "w1", 200, "approved")], // 1 day paid out of 2
    });
    // 200/400 = 50%
    expect(getCollectionRate(state, undefined, new Date(2026, 0, 12))).toBe(50);
  });

  it("returns 0 when no expected amount", () => {
    const state = makeState({ weeks: [] });
    expect(getCollectionRate(state, undefined, new Date(2026, 0, 12))).toBe(0);
  });
});

// ── getElapsedWeekCount ───────────────────────────────────────────

describe("getElapsedWeekCount", () => {
  it("counts past and current weeks", () => {
    const w1 = makeWeek("w1", 1, "2026-01-05", ["2026-01-05"]);
    const w2 = makeWeek("w2", 2, "2026-01-12", ["2026-01-12"]);
    const state = makeState({ weeks: [w1, w2] });
    // Today is in week 2
    expect(getElapsedWeekCount(state, new Date(2026, 0, 13))).toBe(2);
  });
});

// ── fillWeekSavings ───────────────────────────────────────────────

describe("fillWeekSavings", () => {
  it("fills missing days evenly", () => {
    const week = makeWeek("w1", 1, "2026-01-05", ["2026-01-05", "2026-01-06", "2026-01-07"]);
    const state = makeState({ weeks: [week], savings: [] });
    const result = fillWeekSavings(state, "m1", "w1", 300);
    const newSavings = result.filter((s) => s.memberId === "m1");
    expect(newSavings).toHaveLength(3);
    expect(newSavings.reduce((sum, s) => sum + s.amount, 0)).toBe(300);
  });

  it("skips days that already have savings", () => {
    const week = makeWeek("w1", 1, "2026-01-05", ["2026-01-05", "2026-01-06", "2026-01-07"]);
    const state = makeState({
      weeks: [week],
      savings: [makeSaving("m1", "w1", "2026-01-05", 200)],
    });
    const result = fillWeekSavings(state, "m1", "w1", 400);
    const newSavings = result.filter((s) => s.memberId === "m1" && s.weekId === "w1");
    // Only fills 2 remaining days with 400: 200 + 200
    expect(newSavings).toHaveLength(3);
    expect(newSavings.find((s) => s.date === "2026-01-06")?.amount).toBe(200);
    expect(newSavings.find((s) => s.date === "2026-01-07")?.amount).toBe(200);
  });

  it("returns existing savings when amount is 0", () => {
    const state = makeState({ savings: [] });
    expect(fillWeekSavings(state, "m1", "w1", 0)).toEqual([]);
  });

  it("distributes remainder to the last day", () => {
    const week = makeWeek("w1", 1, "2026-01-05", ["2026-01-05", "2026-01-06"]);
    const state = makeState({ weeks: [week], savings: [] });
    const result = fillWeekSavings(state, "m1", "w1", 500);
    const newSavings = result.filter((s) => s.memberId === "m1");
    expect(newSavings[0].amount).toBe(250);
    expect(newSavings[1].amount).toBe(250);
  });

  it("respects maxDays parameter", () => {
    const week = makeWeek("w1", 1, "2026-01-05", ["2026-01-05", "2026-01-06", "2026-01-07"]);
    const state = makeState({ weeks: [week], savings: [] });
    const result = fillWeekSavings(state, "m1", "w1", 400, 2);
    const newSavings = result.filter((s) => s.memberId === "m1" && s.weekId === "w1");
    expect(newSavings).toHaveLength(2);
    expect(newSavings.reduce((sum, s) => sum + s.amount, 0)).toBe(400);
  });
});

// ── spreadPayment ─────────────────────────────────────────────────

describe("spreadPayment", () => {
  it("spreads payment across working days in a week", () => {
    const w1 = makeWeek("w1", 1, "2026-01-05", ["2026-01-05", "2026-01-06", "2026-01-07", "2026-01-08", "2026-01-09"]);
    const state = makeState({
      members: [makeMember("m1")],
      memberPlans: { m1: makePlan(200) },
      weeks: [w1],
    });
    const result = spreadPayment(state, "m1", "w1", 600);
    // 600/200 = 3 days
    expect(result.weeks).toHaveLength(1);
    expect(result.weeks[0].covered).toBe(3);
    expect(result.savings.filter((s) => s.memberId === "m1")).toHaveLength(3);
  });

  it("rolls into next week when payment exceeds current week", () => {
    const w1 = makeWeek("w1", 1, "2026-01-05", ["2026-01-05", "2026-01-06"]);
    const w2 = makeWeek("w2", 2, "2026-01-12", ["2026-01-12", "2026-01-13"]);
    const state = makeState({
      members: [makeMember("m1")],
      memberPlans: { m1: makePlan(200) },
      weeks: [w1, w2],
    });
    const result = spreadPayment(state, "m1", "w1", 600);
    // 600/200 = 3 days: 2 in w1 + 1 in w2
    expect(result.weeks).toHaveLength(2);
    expect(result.weeks[0].covered).toBe(2);
    expect(result.weeks[1].covered).toBe(1);
  });

  it("skips days that already have savings", () => {
    const w1 = makeWeek("w1", 1, "2026-01-05", ["2026-01-05", "2026-01-06", "2026-01-07"]);
    const state = makeState({
      members: [makeMember("m1")],
      memberPlans: { m1: makePlan(200) },
      weeks: [w1],
      savings: [makeSaving("m1", "w1", "2026-01-05", 200)],
    });
    const result = spreadPayment(state, "m1", "w1", 400);
    // 400/200 = 2 days, but first day already saved => fills remaining 2
    expect(result.weeks[0].covered).toBe(2);
  });

  it("returns empty for zero or negative amount", () => {
    const state = makeState({ weeks: [makeWeek("w1", 1, "2026-01-05", ["2026-01-05"])] });
    expect(spreadPayment(state, "m1", "w1", 0).weeks).toEqual([]);
    expect(spreadPayment(state, "m1", "w1", -100).weeks).toEqual([]);
  });

  it("returns empty for invalid weekId", () => {
    const state = makeState({ weeks: [] });
    expect(spreadPayment(state, "m1", "nonexistent", 400).weeks).toEqual([]);
  });
});

// ── planDayCoverage ───────────────────────────────────────────────

describe("planDayCoverage", () => {
  it("returns which dates a payment would cover", () => {
    const w1 = makeWeek("w1", 1, "2026-01-05", ["2026-01-05", "2026-01-06", "2026-01-07"]);
    const state = makeState({
      members: [makeMember("m1")],
      memberPlans: { m1: makePlan(200) },
      weeks: [w1],
    });
    const result = planDayCoverage(state, "m1", "w1", 400);
    expect(result).toHaveLength(1);
    expect(result[0].dates).toEqual(["2026-01-05", "2026-01-06"]);
  });

  it("returns empty for zero amount", () => {
    const state = makeState();
    expect(planDayCoverage(state, "m1", "w1", 0)).toEqual([]);
  });
});

// ── recordDaysPaid ────────────────────────────────────────────────

describe("recordDaysPaid", () => {
  it("adds savings for the given dates", () => {
    const w1 = makeWeek("w1", 1, "2026-01-05", ["2026-01-05", "2026-01-06"]);
    const state = makeState({
      members: [makeMember("m1")],
      memberPlans: { m1: makePlan(200) },
      weeks: [w1],
    });
    const result = recordDaysPaid(state, "m1", ["2026-01-05", "2026-01-06"]);
    expect(result.savings).toHaveLength(2);
    expect(result.payments).toHaveLength(1);
    expect(result.payments[0].amount).toBe(400);
    expect(result.weekIds).toEqual(["w1"]);
  });

  it("skips already-saved dates", () => {
    const w1 = makeWeek("w1", 1, "2026-01-05", ["2026-01-05", "2026-01-06"]);
    const state = makeState({
      members: [makeMember("m1")],
      memberPlans: { m1: makePlan(200) },
      weeks: [w1],
      savings: [makeSaving("m1", "w1", "2026-01-05", 200)],
    });
    const result = recordDaysPaid(state, "m1", ["2026-01-05", "2026-01-06"]);
    // Only 1 new saving added (01-06), total 2 savings (1 existing + 1 new)
    expect(result.savings.filter((s) => s.memberId === "m1")).toHaveLength(2);
    expect(result.savings.find((s) => s.date === "2026-01-06")?.amount).toBe(200);
  });

  it("spans multiple weeks", () => {
    const w1 = makeWeek("w1", 1, "2026-01-05", ["2026-01-05"]);
    const w2 = makeWeek("w2", 2, "2026-01-12", ["2026-01-12"]);
    const state = makeState({
      members: [makeMember("m1")],
      memberPlans: { m1: makePlan(200) },
      weeks: [w1, w2],
    });
    const result = recordDaysPaid(state, "m1", ["2026-01-05", "2026-01-12"]);
    expect(result.weekIds).toContain("w1");
    expect(result.weekIds).toContain("w2");
    expect(result.payments).toHaveLength(2);
  });
});

// ── unmarkDays ────────────────────────────────────────────────────

describe("unmarkDays", () => {
  it("removes savings for the given dates", () => {
    const w1 = makeWeek("w1", 1, "2026-01-05", ["2026-01-05", "2026-01-06"]);
    const state = makeState({
      weeks: [w1],
      savings: [
        makeSaving("m1", "w1", "2026-01-05", 200),
        makeSaving("m1", "w1", "2026-01-06", 200),
      ],
      payments: [makePayment("m1", "w1", 400)],
    });
    const result = unmarkDays(state, "m1", ["2026-01-05"]);
    expect(result.savings).toHaveLength(1);
    expect(result.savings[0].date).toBe("2026-01-06");
    expect(result.payments[0].amount).toBe(200);
  });

  it("removes payment record when all days are unmarked", () => {
    const w1 = makeWeek("w1", 1, "2026-01-05", ["2026-01-05"]);
    const state = makeState({
      weeks: [w1],
      savings: [makeSaving("m1", "w1", "2026-01-05", 200)],
      payments: [makePayment("m1", "w1", 200)],
    });
    const result = unmarkDays(state, "m1", ["2026-01-05"]);
    expect(result.savings).toHaveLength(0);
    expect(result.payments).toHaveLength(0);
  });

  it("returns unchanged state for empty dates", () => {
    const state = makeState({ savings: [makeSaving("m1", "w1", "2026-01-05", 200)] });
    const result = unmarkDays(state, "m1", []);
    expect(result.savings).toEqual(state.savings);
    expect(result.payments).toEqual(state.payments);
  });
});

// ── needsDayRepair ────────────────────────────────────────────────

describe("needsDayRepair", () => {
  it("returns true when a day's amount doesn't match daily rate", () => {
    const w1 = makeWeek("w1", 1, "2026-01-05", ["2026-01-05"]);
    const state = makeState({
      members: [makeMember("m1")],
      memberPlans: { m1: makePlan(200) },
      weeks: [w1],
      savings: [makeSaving("m1", "w1", "2026-01-05", 375)], // corrupted
    });
    expect(needsDayRepair(state)).toBe(true);
  });

  it("returns false when all days match daily rate", () => {
    const w1 = makeWeek("w1", 1, "2026-01-05", ["2026-01-05"]);
    const state = makeState({
      members: [makeMember("m1")],
      memberPlans: { m1: makePlan(200) },
      weeks: [w1],
      savings: [makeSaving("m1", "w1", "2026-01-05", 200)],
    });
    expect(needsDayRepair(state)).toBe(false);
  });

  it("returns false when no savings exist", () => {
    expect(needsDayRepair(makeState())).toBe(false);
  });
});

// ── getPlanForWeek ────────────────────────────────────────────────

describe("getPlanForWeek", () => {
  it("returns the plan that was active for a given week based on history", () => {
    const w1 = makeWeek("w1", 1, "2026-01-05", ["2026-01-05"]);
    const w2 = makeWeek("w2", 2, "2026-01-12", ["2026-01-12"]);
    const plan200 = makePlan(200);
    const plan300 = makePlan(300);
    const state = makeState({
      members: [makeMember("m1")],
      memberPlans: { m1: plan200 },
      planHistory: {
        m1: [
          {
            id: "change-1",
            plan: plan300,
            previousPlan: plan200,
            appliedAt: "2026-01-10",
            effectiveFrom: "2026-01-12",
            scope: "next-week",
          },
        ],
      },
      weeks: [w1, w2],
    });
    // w1 starts Jan 5, change effective Jan 12 => w1 keeps old plan
    expect(getPlanForWeek(state, "m1", w1).dailyAmount).toBe(200);
    // w2 starts Jan 12, change effective Jan 12 => w2 gets new plan
    expect(getPlanForWeek(state, "m1", w2).dailyAmount).toBe(300);
  });

  it("returns the default plan when no history exists", () => {
    const w1 = makeWeek("w1", 1, "2026-01-05", ["2026-01-05"]);
    const state = makeState({
      members: [makeMember("m1")],
      memberPlans: { m1: makePlan(200) },
      weeks: [w1],
    });
    expect(getPlanForWeek(state, "m1", w1).dailyAmount).toBe(200);
  });
});

// ── getExpectedSavingsToDate ──────────────────────────────────────

describe("getExpectedSavingsToDate", () => {
  it("sums weekly targets for past + current weeks", () => {
    const w1 = makeWeek("w1", 1, "2026-01-05", ["2026-01-05", "2026-01-06"]);
    const w2 = makeWeek("w2", 2, "2026-01-12", ["2026-01-12", "2026-01-13"]);
    const state = makeState({
      members: [makeMember("m1")],
      memberPlans: { m1: makePlan(200) },
      weeks: [w1, w2],
    });
    // Today is in w2 (Jan 13), both w1 and w2 are past/current
    // w1: 2*200=400, w2: 2*200=400 => 800
    expect(getExpectedSavingsToDate(state, "m1")).toBe(800);
  });
});
