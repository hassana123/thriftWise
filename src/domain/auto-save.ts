import type { DaySaving, ThriftState } from "@/domain/types";
import { iso } from "@/domain/calendar";

// After this hour, the day's contribution is recorded automatically for every
// active member, so nobody has to remember to tap "saved" each day.
export const AUTO_SAVE_HOUR = 18;

export function applyAutoSave(state: ThriftState, now: Date = new Date()): ThriftState {
  if (now.getHours() < AUTO_SAVE_HOUR) return state;

  const todayIso = iso(now);
  const dow = now.getDay() === 0 ? 7 : now.getDay();
  if (!state.settings.workingDays.includes(dow)) return state;

  const week = state.weeks.find((w) => w.days.some((d) => d.date === todayIso));
  if (!week) return state;

  const alreadyMarked = new Set(
    state.savings.filter((s) => s.date === todayIso).map((s) => s.memberId)
  );

  const newSavings: DaySaving[] = [];
  const marked: string[] = [];
  let added = 0;

  for (const member of state.members) {
    if (member.status !== "active" || alreadyMarked.has(member.id)) continue;
    const plan = state.memberPlans[member.id];
    if (!plan || plan.dailyAmount <= 0) continue;
    newSavings.push({
      id: `${member.id}-${todayIso}`,
      memberId: member.id,
      weekId: week.id,
      date: todayIso,
      amount: plan.dailyAmount,
    });
    added += plan.dailyAmount;
    marked.push(member.name.split(" ")[0]);
  }

  if (newSavings.length === 0) return state;

  return {
    ...state,
    savings: [...state.savings, ...newSavings],
    activities: [
      {
        id: `act-auto-${todayIso}`,
        thriftId: state.id,
        actorId: "system",
        type: "saving",
        message: `Today's contributions recorded automatically for ${marked.join(", ")}`,
        amount: added,
        createdAt: iso(now),
      },
      ...state.activities,
    ],
  };
}
