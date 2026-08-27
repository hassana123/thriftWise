import { describe, it, expect } from "vitest";
import { iso, parseDay, getWeekStatus, getCurrentWeek, getNextUpcomingWeek, daysBetween, getConsecutiveStreak } from "@/domain/calendar";
import type { ThriftSettings, ThriftWeek } from "@/domain/types";

function makeSettings(overrides: Partial<ThriftSettings> = {}): ThriftSettings {
  return {
    name: "Test Thrift",
    startDate: "2026-01-05",
    vacationDate: "2026-04-30",
    workingDays: [1, 2, 3, 4, 5],
    defaultDailyAmount: 200,
    paymentAccount: { bank: "Test Bank", accountName: "Test", accountNumber: "1234567890" },
    currency: "NGN",
    ...overrides,
  };
}

function makeWeek(id: string, startDate: string, endDate: string, dayCount = 5): ThriftWeek {
  const days = Array.from({ length: dayCount }, (_, i) => ({
    date: iso(addDays(parseDay(startDate), i)),
    index: i,
  }));
  return { id, number: parseInt(id.replace("week-", "")), startDate, endDate: endDate ?? days[days.length - 1].date, days };
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

describe("iso", () => {
  it("formats a date as yyyy-MM-dd", () => {
    expect(iso(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("pads single-digit months and days", () => {
    expect(iso(new Date(2026, 2, 9))).toBe("2026-03-09");
  });
});

describe("parseDay", () => {
  it("parses a yyyy-MM-dd string to a Date", () => {
    const d = parseDay("2026-03-15");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(2); // March (0-indexed)
    expect(d.getDate()).toBe(15);
  });
});

describe("getWeekStatus", () => {
  const week: ThriftWeek = {
    id: "week-1",
    number: 1,
    startDate: "2026-01-05", // Monday
    endDate: "2026-01-09",
    days: [
      { date: "2026-01-05", index: 0 },
      { date: "2026-01-06", index: 1 },
      { date: "2026-01-07", index: 2 },
      { date: "2026-01-08", index: 3 },
      { date: "2026-01-09", index: 4 },
    ],
  };

  it("returns 'past' for a date after the week", () => {
    expect(getWeekStatus(week, new Date(2026, 0, 12))).toBe("past");
  });

  it("returns 'current' for a date within the week", () => {
    expect(getWeekStatus(week, new Date(2026, 0, 7))).toBe("current");
  });

  it("returns 'upcoming' for a date before the week", () => {
    expect(getWeekStatus(week, new Date(2026, 0, 1))).toBe("upcoming");
  });

  it("returns 'current' on the first day of the week", () => {
    expect(getWeekStatus(week, new Date(2026, 0, 5))).toBe("current");
  });

  it("returns 'current' on the last day of the week", () => {
    expect(getWeekStatus(week, new Date(2026, 0, 9))).toBe("current");
  });
});

describe("getCurrentWeek", () => {
  const weeks: ThriftWeek[] = [
    {
      id: "week-1",
      number: 1,
      startDate: "2026-01-05",
      endDate: "2026-01-09",
      days: [
        { date: "2026-01-05", index: 0 },
        { date: "2026-01-06", index: 1 },
        { date: "2026-01-07", index: 2 },
        { date: "2026-01-08", index: 3 },
        { date: "2026-01-09", index: 4 },
      ],
    },
    {
      id: "week-2",
      number: 2,
      startDate: "2026-01-12",
      endDate: "2026-01-16",
      days: [
        { date: "2026-01-12", index: 0 },
        { date: "2026-01-13", index: 1 },
        { date: "2026-01-14", index: 2 },
        { date: "2026-01-15", index: 3 },
        { date: "2026-01-16", index: 4 },
      ],
    },
  ];

  it("finds the current week based on today's date", () => {
    expect(getCurrentWeek(weeks, new Date(2026, 0, 7))?.id).toBe("week-1");
    expect(getCurrentWeek(weeks, new Date(2026, 0, 13))?.id).toBe("week-2");
  });

  it("returns null when no week matches", () => {
    expect(getCurrentWeek(weeks, new Date(2025, 11, 25))).toBeNull();
  });
});

describe("getNextUpcomingWeek", () => {
  const weeks: ThriftWeek[] = [
    {
      id: "week-1",
      number: 1,
      startDate: "2026-01-05",
      endDate: "2026-01-09",
      days: [{ date: "2026-01-05", index: 0 }],
    },
    {
      id: "week-2",
      number: 2,
      startDate: "2026-01-12",
      endDate: "2026-01-16",
      days: [{ date: "2026-01-12", index: 0 }],
    },
  ];

  it("returns the next week after today", () => {
    expect(getNextUpcomingWeek(weeks, new Date(2026, 0, 7))?.id).toBe("week-2");
  });

  it("returns null when all weeks are in the past", () => {
    expect(getNextUpcomingWeek(weeks, new Date(2026, 1, 1))).toBeNull();
  });
});

describe("daysBetween", () => {
  it("returns the number of days between two dates", () => {
    expect(daysBetween("2026-01-05", "2026-01-10")).toBe(5);
  });

  it("returns 0 for the same date", () => {
    expect(daysBetween("2026-01-05", "2026-01-05")).toBe(0);
  });

  it("returns negative for reversed dates", () => {
    expect(daysBetween("2026-01-10", "2026-01-05")).toBe(-5);
  });
});

describe("getConsecutiveStreak", () => {
  it("counts consecutive saved days from the end", () => {
    const dates = [new Date(2026, 0, 5), new Date(2026, 0, 6), new Date(2026, 0, 7), new Date(2026, 0, 8)];
    const saved = new Set(["2026-01-06", "2026-01-07", "2026-01-08"]);
    expect(getConsecutiveStreak(dates, (d) => saved.has(d))).toBe(3);
  });

  it("returns 0 when no days are saved", () => {
    const dates = [new Date(2026, 0, 5), new Date(2026, 0, 6)];
    expect(getConsecutiveStreak(dates, () => false)).toBe(0);
  });

  it("returns 0 for empty array", () => {
    expect(getConsecutiveStreak([], () => true)).toBe(0);
  });

  it("breaks streak at first unsaved day from the end", () => {
    const dates = [new Date(2026, 0, 5), new Date(2026, 0, 6), new Date(2026, 0, 7)];
    const saved = new Set(["2026-01-05", "2026-01-07"]); // gap at 06
    expect(getConsecutiveStreak(dates, (d) => saved.has(d))).toBe(1);
  });
});
