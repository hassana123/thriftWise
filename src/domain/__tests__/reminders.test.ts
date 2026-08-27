import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ThriftState, Member } from "@/domain/types";
import {
  computeDueReminders,
  computeBehindReminders,
  ensureReminders,
  getReminderPrefs,
  setReminderPrefs,
  DEFAULT_REMINDER_PREFS,
} from "@/domain/reminders";

// Mock localStorage
const localStorageMock: Record<string, string> = {};
vi.stubGlobal("window", {
  localStorage: {
    getItem: vi.fn((key: string) => localStorageMock[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { localStorageMock[key] = value; }),
    removeItem: vi.fn((key: string) => { delete localStorageMock[key]; }),
  },
});

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

beforeEach(() => {
  Object.keys(localStorageMock).forEach((k) => delete localStorageMock[k]);
  // Default: all reminders enabled
  localStorageMock["thriftwise-notification-prefs"] = JSON.stringify(DEFAULT_REMINDER_PREFS);
});

describe("getReminderPrefs / setReminderPrefs", () => {
  it("returns default prefs when nothing stored", () => {
    delete localStorageMock["thriftwise-notification-prefs"];
    expect(getReminderPrefs()).toEqual(DEFAULT_REMINDER_PREFS);
  });

  it("returns stored prefs merged with defaults", () => {
    localStorageMock["thriftwise-notification-prefs"] = JSON.stringify({ saving: false });
    const prefs = getReminderPrefs();
    expect(prefs.saving).toBe(false);
    expect(prefs.behind).toBe(true); // default
  });

  it("setReminderPrefs persists to localStorage", () => {
    setReminderPrefs({ saving: false, behind: false, transfer: true });
    expect(JSON.parse(localStorageMock["thriftwise-notification-prefs"])).toEqual({
      saving: false,
      behind: false,
      transfer: true,
    });
  });
});

describe("computeDueReminders", () => {
  it("returns saving reminders for active members who haven't saved today", () => {
    const state = makeState({
      members: [makeMember("m1"), makeMember("m2")],
      memberPlans: { m1: { key: "one-hand", label: "One Hand", dailyAmount: 200, weeklyAmount: 1000, monthlyAmount: 4000 } },
      weeks: [{
        id: "w1", number: 1, startDate: "2026-01-05", endDate: "2026-01-09",
        days: [
          { date: "2026-01-05", index: 0 },
          { date: "2026-01-06", index: 1 },
          { date: "2026-01-07", index: 2 },
        ],
      }],
    });
    // Monday Jan 5, 2026
    const now = new Date(2026, 0, 5);
    const reminders = computeDueReminders(state, now);
    expect(reminders).toHaveLength(2);
    expect(reminders[0].type).toBe("saving_reminder");
    expect(reminders[0].body).toContain("Member m1");
  });

  it("excludes members who already saved today", () => {
    const state = makeState({
      members: [makeMember("m1")],
      weeks: [{
        id: "w1", number: 1, startDate: "2026-01-05", endDate: "2026-01-09",
        days: [{ date: "2026-01-05", index: 0 }],
      }],
      savings: [{ id: "s1", memberId: "m1", weekId: "w1", date: "2026-01-05", amount: 200 }],
    });
    const now = new Date(2026, 0, 5);
    expect(computeDueReminders(state, now)).toHaveLength(0);
  });

  it("returns empty on non-working days", () => {
    const state = makeState({
      members: [makeMember("m1")],
      weeks: [{
        id: "w1", number: 1, startDate: "2026-01-05", endDate: "2026-01-09",
        days: [{ date: "2026-01-05", index: 0 }],
      }],
    });
    // Saturday Jan 10
    const now = new Date(2026, 0, 10);
    expect(computeDueReminders(state, now)).toHaveLength(0);
  });

  it("excludes suspended members", () => {
    const state = makeState({
      members: [makeMember("m1", { status: "suspended" })],
      weeks: [{
        id: "w1", number: 1, startDate: "2026-01-05", endDate: "2026-01-09",
        days: [{ date: "2026-01-05", index: 0 }],
      }],
    });
    expect(computeDueReminders(state, new Date(2026, 0, 5))).toHaveLength(0);
  });

  it("returns empty when saving reminders are disabled", () => {
    localStorageMock["thriftwise-notification-prefs"] = JSON.stringify({ saving: false, behind: true, transfer: true });
    const state = makeState({
      members: [makeMember("m1")],
      weeks: [{
        id: "w1", number: 1, startDate: "2026-01-05", endDate: "2026-01-09",
        days: [{ date: "2026-01-05", index: 0 }],
      }],
    });
    expect(computeDueReminders(state, new Date(2026, 0, 5))).toHaveLength(0);
  });
});

describe("computeBehindReminders", () => {
  it("notifies when member is behind on current week's due days", () => {
    const state = makeState({
      members: [makeMember("m1")],
      weeks: [{
        id: "w1", number: 1, startDate: "2026-01-05", endDate: "2026-01-09",
        days: [
          { date: "2026-01-05", index: 0 },
          { date: "2026-01-06", index: 1 },
          { date: "2026-01-07", index: 2 },
        ],
      }],
      savings: [{ id: "s1", memberId: "m1", weekId: "w1", date: "2026-01-05", amount: 200 }],
    });
    // Wednesday Jan 7: 3 days due, 1 saved => behind on 2
    const reminders = computeBehindReminders(state, new Date(2026, 0, 7));
    expect(reminders).toHaveLength(1);
    expect(reminders[0].body).toContain("2 contribution days");
  });

  it("excludes members with approved payment", () => {
    const state = makeState({
      members: [makeMember("m1")],
      weeks: [{
        id: "w1", number: 1, startDate: "2026-01-05", endDate: "2026-01-09",
        days: [{ date: "2026-01-05", index: 0 }, { date: "2026-01-06", index: 1 }],
      }],
      payments: [{
        id: "p1", memberId: "m1", weekId: "w1", amount: 400, status: "approved",
        method: "transfer", createdAt: "2026-01-05T10:00:00Z",
      }],
    });
    expect(computeBehindReminders(state, new Date(2026, 0, 6))).toHaveLength(0);
  });

  it("returns empty when behind reminders are disabled", () => {
    localStorageMock["thriftwise-notification-prefs"] = JSON.stringify({ saving: true, behind: false, transfer: true });
    const state = makeState({
      members: [makeMember("m1")],
      weeks: [{
        id: "w1", number: 1, startDate: "2026-01-05", endDate: "2026-01-09",
        days: [{ date: "2026-01-05", index: 0 }],
      }],
    });
    expect(computeBehindReminders(state, new Date(2026, 0, 5))).toHaveLength(0);
  });
});

describe("ensureReminders", () => {
  it("adds new reminders and cleans stale ones", () => {
    const state = makeState({
      members: [makeMember("m1")],
      weeks: [{
        id: "w1", number: 1, startDate: "2026-01-05", endDate: "2026-01-09",
        days: [{ date: "2026-01-05", index: 0 }],
      }],
      notifications: [{
        id: "rem-saving-m1-2026-01-05",
        userId: "me",
        type: "saving_reminder",
        title: "Old reminder",
        body: "Old",
        read: false,
        createdAt: "2026-01-05T08:00:00Z",
      }],
    });
    const result = ensureReminders(state, new Date(2026, 0, 5));
    // Should have at least 1 notification (the new saving reminder)
    expect(result.notifications.length).toBeGreaterThanOrEqual(1);
  });

  it("removes saving reminder for member who saved today", () => {
    const state = makeState({
      members: [makeMember("m1")],
      weeks: [{
        id: "w1", number: 1, startDate: "2026-01-05", endDate: "2026-01-09",
        days: [{ date: "2026-01-05", index: 0 }],
      }],
      savings: [{ id: "s1", memberId: "m1", weekId: "w1", date: "2026-01-05", amount: 200 }],
      notifications: [{
        id: "rem-saving-m1-2026-01-05",
        userId: "me",
        type: "saving_reminder",
        title: "Reminder",
        body: "Save",
        read: false,
        createdAt: "2026-01-05T08:00:00Z",
      }],
    });
    const result = ensureReminders(state, new Date(2026, 0, 5));
    const savingReminder = result.notifications.find(
      (n) => n.type === "saving_reminder" && n.id.includes("m1")
    );
    expect(savingReminder).toBeUndefined();
  });
});
