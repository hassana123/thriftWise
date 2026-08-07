"use client";

import * as React from "react";

import type { ThriftState, ThriftWeek } from "@/domain/types";
import {
  getCurrentWeek,
  getWeekStatus,
  getWorkingDayDates,
  getConsecutiveStreak,
  iso,
  parseDay,
} from "@/domain/calendar";
import {
  getMemberPlan,
  getWeeklyTarget,
  getWeekSavings,
  getTotalSaved,
  getTotalTransferred,
  getOutstandingBalance,
  getFamilySavings,
  getFamilyRanking,
  getWeekProgress,
} from "@/domain/calculations";

export interface MemberStats {
  currentWeek: ThriftWeek | null;
  weeklyTarget: number;
  weekSaved: number;
  weekProgress: number;
  daysCompletedInWeek: number;
  weekRemaining: number;
  isWorkingDayToday: boolean;
  todayTarget: number;
  savedToday: number;
  totalDaysInWeek: number;
  streak: number;
  balance: number;
  transferred: number;
  outstanding: number;
  expectedToDate: number;
  completedWeeks: number;
  pendingWeeks: number;
  missedWeeks: number;
  totalWeeks: number;
  elapsedWeeks: number;
  totalGoal: number;
  readiness: number;
  rank: number;
  familySavings: number;
  memberCount: number;
  vacationDaysLeft: number;
  vacationProgress: number;
  savingsHistory: { date: string; amount: number }[];
}

export function useMemberStats(state: ThriftState | null, memberId?: string): MemberStats | null {
  return React.useMemo(() => {
    if (!state || !memberId) return null;
    const plan = getMemberPlan(state, memberId);
    if (!plan) return null;

    const today = new Date();
    const currentWeek = getCurrentWeek(state.weeks, today);
    const weeklyTarget = currentWeek ? getWeeklyTarget(state, memberId, currentWeek) : 0;
    const weekSaved = currentWeek ? getWeekSavings(state.savings, memberId, currentWeek.id) : 0;
    const weekProgress = currentWeek ? getWeekProgress(state, memberId, currentWeek) : 0;

    const daysCompletedInWeek = currentWeek
      ? currentWeek.days.filter((d) => {
          const amount = state.savings.find(
            (s) => s.memberId === memberId && s.date === d.date
          )?.amount;
          return (amount ?? 0) > 0;
        }).length
      : 0;

    const dow = today.getDay() === 0 ? 7 : today.getDay();
    const isWorkingDayToday = state.settings.workingDays.includes(dow);
    const todayIso = iso(today);
    const savedToday =
      state.savings.find((s) => s.memberId === memberId && s.date === todayIso)?.amount ?? 0;

    const workingDates = getWorkingDayDates(state.settings);
    const hasSavedOn = (date: string) =>
      (state.savings.find((s) => s.memberId === memberId && s.date === date)?.amount ?? 0) > 0;
    const streak = getConsecutiveStreak(workingDates, hasSavedOn);

    const balance = getTotalSaved(state, memberId);
    const transferred = getTotalTransferred(state, memberId);
    const outstanding = getOutstandingBalance(state, memberId);
    const expectedToDate = state.weeks
      .filter((w) => w.endDate < todayIso)
      .reduce((sum, w) => sum + getWeeklyTarget(state, memberId, w), 0);

    const completedWeeks = state.payments.filter(
      (p) => p.memberId === memberId && p.status === "approved"
    ).length;

    const pendingWeeks = state.payments.filter(
      (p) => p.memberId === memberId && p.status === "pending"
    ).length;

    const missedWeeks = state.weeks.filter((w) => {
      if (getWeekStatus(w, today) !== "past") return false;
      const payment = state.payments.find(
        (p) => p.memberId === memberId && p.weekId === w.id
      );
      return !payment || payment.status !== "approved";
    }).length;

    const totalWeeks = state.weeks.length;
    const elapsedWeeks = state.weeks.filter((w) => getWeekStatus(w, today) !== "upcoming").length;
    const totalGoal = state.weeks.reduce(
      (sum, w) => sum + getWeeklyTarget(state, memberId, w),
      0
    );
    const readiness = totalGoal > 0 ? Math.round((transferred / totalGoal) * 100) : 0;

    const ranking = getFamilyRanking(state);
    const rank = ranking.findIndex((m) => m.id === memberId) + 1;

    const vacationStart = parseDay(state.settings.vacationDate);
    const vacationDaysLeft = Math.max(0, Math.ceil((vacationStart.getTime() - today.getTime()) / 86400000));
    const thriftStart = parseDay(state.settings.startDate);
    const totalDuration = Math.max(1, vacationStart.getTime() - thriftStart.getTime());
    const vacationProgress = Math.min(
      100,
      Math.round(((today.getTime() - thriftStart.getTime()) / totalDuration) * 100)
    );

    const savingsHistory = state.savings
      .filter((s) => s.memberId === memberId)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 8)
      .map((s) => ({ date: s.date, amount: s.amount }));

    return {
      currentWeek,
      weeklyTarget,
      weekSaved,
      weekProgress,
      daysCompletedInWeek,
      totalDaysInWeek: currentWeek ? currentWeek.days.length : 0,
      weekRemaining: Math.max(0, weeklyTarget - weekSaved),
      isWorkingDayToday,
      todayTarget: plan.dailyAmount,
      savedToday,
      streak,
      balance,
      transferred,
      outstanding,
      expectedToDate,
      completedWeeks,
      pendingWeeks,
      missedWeeks,
      totalWeeks,
      elapsedWeeks,
      totalGoal,
      readiness,
      rank,
      familySavings: getFamilySavings(state),
      memberCount: state.members.filter((m) => m.status !== "suspended").length,
      vacationDaysLeft,
      vacationProgress,
      savingsHistory,
    };
  }, [state, memberId]);
}
