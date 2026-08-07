import type { Notification, ThriftState } from "@/domain/types";
import { getCurrentWeek, isWorkingDay, iso } from "@/domain/calendar";

export interface ReminderPrefs {
  saving: boolean;
  behind: boolean;
  transfer: boolean;
}

export const DEFAULT_REMINDER_PREFS: ReminderPrefs = {
  saving: true,
  behind: true,
  transfer: true,
};

const PREFS_KEY = "thriftwise-notification-prefs";

export function getReminderPrefs(): ReminderPrefs {
  if (typeof window === "undefined") return DEFAULT_REMINDER_PREFS;
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_REMINDER_PREFS;
    return { ...DEFAULT_REMINDER_PREFS, ...(JSON.parse(raw) as Partial<ReminderPrefs>) };
  } catch {
    return DEFAULT_REMINDER_PREFS;
  }
}

export function setReminderPrefs(prefs: ReminderPrefs): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

export function computeDueReminders(state: ThriftState, now = new Date()): Notification[] {
  if (!getReminderPrefs().saving) return [];
  if (!isWorkingDay(now, state.settings)) return [];

  const todayKey = iso(now);
  const currentWeek = getCurrentWeek(state.weeks, now);
  if (!currentWeek || !currentWeek.days.some((d) => d.date === todayKey)) return [];

  const savedToday = new Set(state.savings.filter((s) => s.date === todayKey).map((s) => s.memberId));
  const out: Notification[] = [];

  for (const member of state.members) {
    if (member.status !== "active" || savedToday.has(member.id)) continue;
    const daily = state.memberPlans[member.id]?.dailyAmount ?? state.settings.defaultDailyAmount;
    out.push({
      id: `rem-saving-${member.id}-${todayKey}`,
      userId: "me",
      type: "saving_reminder",
      title: "Don't forget to save today",
      body: `Hi ${member.name}, a ₦${daily.toLocaleString()} contribution is due today.`,
      read: false,
      createdAt: new Date().toISOString(),
    });
  }

  return out;
}

export function computeBehindReminders(state: ThriftState, now = new Date()): Notification[] {
  if (!getReminderPrefs().behind) return [];

  const currentWeek = getCurrentWeek(state.weeks, now);
  if (!currentWeek) return [];

  const todayKey = iso(now);
  const dueDays = currentWeek.days.filter((d) => d.date <= todayKey);
  if (dueDays.length === 0) return [];

  const out: Notification[] = [];
  const weekSavings = state.savings.filter(
    (s) => s.date >= currentWeek.startDate && s.date <= currentWeek.endDate
  );

  for (const member of state.members) {
    if (member.status !== "active") continue;
    const paid = state.payments.find(
      (p) => p.memberId === member.id && p.weekId === currentWeek.id && p.status === "approved"
    );
    if (paid) continue;

    const savedDays = new Set(weekSavings.filter((s) => s.memberId === member.id).map((s) => s.date));
    const missed = dueDays.filter((d) => !savedDays.has(d.date));
    if (missed.length === 0) continue;

    out.push({
      id: `rem-behind-${member.id}-${currentWeek.id}`,
      userId: "me",
      type: "behind_target",
      title: "Behind on savings",
      body: `${member.name} is behind on ${missed.length} contribution day${missed.length > 1 ? "s" : ""} this week.`,
      read: false,
      createdAt: new Date().toISOString(),
    });
  }

  return out;
}

export function ensureReminders(state: ThriftState, now = new Date()): ThriftState {
  const todayKey = iso(now);

  // Drop stale "save today" reminders for members who have since recorded a saving.
  const savedToday = new Set(state.savings.filter((s) => s.date === todayKey).map((s) => s.memberId));
  const cleared = state.notifications.filter((n) => {
    if (n.type !== "saving_reminder") return true;
    const match = n.id.match(/^rem-saving-(.+)-(\d{4}-\d{2}-\d{2})$/);
    if (!match || match[2] !== todayKey) return true;
    return !savedToday.has(match[1]);
  });

  const existing = new Set(cleared.map((n) => n.id));
  const incoming = [...computeDueReminders(state, now), ...computeBehindReminders(state, now)].filter(
    (n) => !existing.has(n.id)
  );
  if (incoming.length === 0 && cleared.length === state.notifications.length) return state;

  return { ...state, notifications: [...cleared, ...incoming].slice(-60) };
}
