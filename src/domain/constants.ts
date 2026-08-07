import type { ContributionPlan, PlanKey } from "@/domain/types";

export const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const FULL_DAY_LABELS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export const DEFAULT_WORKING_DAYS = [1, 2, 3, 4, 5];

export const AVATAR_COLORS = [
  "#16A34A",
  "#0EA5E9",
  "#8B5CF6",
  "#F59E0B",
  "#EF4444",
  "#EC4899",
  "#14B8A6",
  "#6366F1",
];

export function planKeyFromAmount(daily: number): PlanKey {
  if (daily === 200) return "one-hand";
  if (daily === 300) return "one-half-hand";
  if (daily === 400) return "two-hands";
  return "custom";
}

export function buildPlan(key: PlanKey, dailyAmount: number, weeklyAmount?: number): ContributionPlan {
  const daily = Math.round(dailyAmount);
  const weekly = Math.round(weeklyAmount ?? daily * 5);
  const monthly = Math.round(weekly * 4);
  const labels: Record<PlanKey, { label: string; description: string }> = {
    "one-hand": { label: "One Hand", description: "Save ₦200 daily, ₦1,000 weekly" },
    "one-half-hand": { label: "One & Half Hands", description: "Save ₦300 daily, ₦1,500 weekly" },
    "two-hands": { label: "Two Hands", description: "Save ₦400 daily, ₦2,000 weekly" },
    custom: { label: "Custom Plan", description: "Choose your own daily amount" },
  };
  return {
    key,
    label: labels[key].label,
    description: labels[key].description,
    dailyAmount: daily,
    weeklyAmount: weekly,
    monthlyAmount: monthly,
  };
}

export const STANDARD_PLANS: Record<PlanKey, ContributionPlan> = {
  "one-hand": buildPlan("one-hand", 200),
  "one-half-hand": buildPlan("one-half-hand", 300),
  "two-hands": buildPlan("two-hands", 400),
  custom: buildPlan("custom", 200),
};
