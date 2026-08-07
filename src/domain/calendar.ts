import {
  startOfWeek,
  endOfWeek,
  addDays,
  isBefore,
  isAfter,
  isSameDay,
  parseISO,
  format,
  eachDayOfInterval,
  differenceInCalendarDays,
  startOfDay,
} from "date-fns";

import type { ThriftSettings, ThriftWeek, ThriftWeekDay } from "@/domain/types";
import { DEFAULT_WORKING_DAYS } from "@/domain/constants";

export function iso(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function parseDay(day: string): Date {
  return parseISO(day);
}

export function toStartOfDay(date: Date): Date {
  return startOfDay(date);
}

export function isWorkingDay(date: Date, settings: ThriftSettings): boolean {
  const jsDay = date.getDay();
  const dow = jsDay === 0 ? 7 : jsDay;
  return settings.workingDays.includes(dow);
}

export function generateWeeks(settings: ThriftSettings): ThriftWeek[] {
  const start = toStartOfDay(parseDay(settings.startDate));
  const vacation = toStartOfDay(parseDay(settings.vacationDate));
  const workingDays = settings.workingDays.length > 0 ? settings.workingDays : DEFAULT_WORKING_DAYS;

  const weeks: ThriftWeek[] = [];
  let cursor = startOfWeek(start, { weekStartsOn: 1 });
  let number = 1;

  while (cursor.getTime() <= endOfWeek(vacation, { weekStartsOn: 1 }).getTime()) {
    const weekStart = startOfWeek(cursor, { weekStartsOn: 1 });
    const days: ThriftWeekDay[] = [];

    for (const dow of workingDays) {
      const dayDate = addDays(weekStart, dow - 1);
      if (
        (isSameDay(dayDate, start) || isAfter(dayDate, start)) &&
        (isSameDay(dayDate, vacation) || isBefore(dayDate, vacation))
      ) {
        days.push({ date: iso(dayDate), index: days.length });
      }
    }

    if (days.length > 0) {
      weeks.push({
        id: `week-${number}`,
        number,
        startDate: days[0].date,
        endDate: days[days.length - 1].date,
        days,
      });
      number += 1;
    }

    cursor = addDays(cursor, 7);
  }

  return weeks;
}

export function getCurrentWeek(weeks: ThriftWeek[], today = new Date()): ThriftWeek | null {
  const day = toStartOfDay(today);
  const current = weeks.find((w) => {
    const s = parseDay(w.startDate);
    const e = parseDay(w.endDate);
    return (isSameDay(day, s) || isAfter(day, s)) && (isSameDay(day, e) || isBefore(day, e));
  });
  return current ?? null;
}

export function getWeekStatus(week: ThriftWeek, today = new Date()): "upcoming" | "current" | "past" {
  const day = toStartOfDay(today);
  if (isBefore(day, parseDay(week.startDate))) return "upcoming";
  if (isAfter(day, parseDay(week.endDate))) return "past";
  return "current";
}

export function getNextUpcomingWeek(weeks: ThriftWeek[], today = new Date()): ThriftWeek | null {
  const day = toStartOfDay(today);
  const sorted = [...weeks].sort((a, b) => parseDay(a.startDate).getTime() - parseDay(b.startDate).getTime());
  const next = sorted.find((w) => isAfter(parseDay(w.startDate), day));
  return next ?? null;
}

export function getPreviousWeeks(weeks: ThriftWeek[], currentWeekId?: string): ThriftWeek[] {
  return weeks.filter((w) => w.id !== currentWeekId);
}

export function getWorkingDayDates(settings: ThriftSettings): Date[] {
  const start = toStartOfDay(parseDay(settings.startDate));
  const today = toStartOfDay(new Date());
  if (isBefore(today, start)) return [];
  const all = eachDayOfInterval({ start, end: today });
  return all.filter((d) => isWorkingDay(d, settings));
}

export function getConsecutiveStreak(
  workingDates: Date[],
  hasSavedOn: (date: string) => boolean
): number {
  if (workingDates.length === 0) return 0;
  let streak = 0;
  for (let i = workingDates.length - 1; i >= 0; i--) {
    if (hasSavedOn(iso(workingDates[i]))) {
      streak += 1;
    } else {
      break;
    }
  }
  return streak;
}

export function getDaysInMonth(date: Date): Date[] {
  return eachDayOfInterval({
    start: new Date(date.getFullYear(), date.getMonth(), 1),
    end: new Date(date.getFullYear(), date.getMonth() + 1, 0),
  });
}

export function daysBetween(start: string, end: string): number {
  return differenceInCalendarDays(parseDay(end), parseDay(start));
}
