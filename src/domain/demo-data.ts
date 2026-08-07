import {
  addDays,
  startOfWeek,
  startOfDay,
  subDays,
  format,
  parseISO,
  isSameDay,
  isBefore,
  isAfter,
} from "date-fns";

import type {
  ActivityEvent,
  AppState,
  DaySaving,
  Member,
  PlanChangeEvent,
  ThriftState,
  WeekPayment,
} from "@/domain/types";
import { STANDARD_PLANS, AVATAR_COLORS } from "@/domain/constants";
import { generateWeeks, iso, parseDay, toStartOfDay } from "@/domain/calendar";

const TODAY = startOfDay(new Date());

function buildMember(
  id: string,
  name: string,
  role: "admin" | "member",
  colorIndex: number,
  email?: string
): Member {
  return {
    id,
    name,
    role,
    color: AVATAR_COLORS[colorIndex % AVATAR_COLORS.length],
    status: "active",
    joinedAt: iso(subDays(TODAY, 49)),
    email,
  };
}

function makeSaving(memberId: string, weekId: string, date: string, amount: number): DaySaving {
  return { id: `${memberId}-${date}`, memberId, weekId, date, amount };
}

function makePayment(
  memberId: string,
  weekId: string,
  amount: number,
  status: WeekPayment["status"],
  overrides: Partial<WeekPayment> = {}
): WeekPayment {
  const paidAt = iso(subDays(TODAY, 3));
  return {
    id: `${memberId}-${weekId}`,
    memberId,
    weekId,
    amount,
    status,
    method: status === "approved" ? "transfer" : "transfer",
    receiptStatus: status === "approved" ? "approved" : status === "pending" ? "pending" : undefined,
    paidAt: status !== "pending" ? paidAt : undefined,
    approvedAt: status === "approved" ? paidAt : undefined,
    createdAt: paidAt,
    ...overrides,
  };
}

export function buildDemoState(): AppState {
  const members: Member[] = [
    buildMember("hassana", "Hassana", "admin", 0, "hassana@thriftwise.app"),
    buildMember("habiba", "Habiba", "member", 1, "habiba@thriftwise.app"),
    buildMember("yusuf", "Yusuf", "member", 2, "yusuf@thriftwise.app"),
    buildMember("junior", "Junior", "member", 3, "junior@thriftwise.app"),
    buildMember("me", "Me", "member", 4, "me@thriftwise.app"),
  ];

  const weekStart = startOfWeek(TODAY, { weekStartsOn: 1 });
  const startDate = iso(addDays(weekStart, -42));
  const vacationDate = iso(addDays(weekStart, 84));

  const thrift: ThriftState = {
    id: "demo-thrift",
    settings: {
      name: "December Family Vacation",
      startDate,
      vacationDate,
      workingDays: [1, 2, 3, 4, 5],
      defaultDailyAmount: 200,
      currency: "NGN",
      paymentAccount: {
        bank: "OPay",
        accountName: "Hassana Abdullahi",
        accountNumber: "8102920194",
      },
    },
    members,
    memberPlans: {
      hassana: STANDARD_PLANS["one-hand"],
      habiba: STANDARD_PLANS["one-half-hand"],
      yusuf: STANDARD_PLANS["two-hands"],
      junior: STANDARD_PLANS["one-hand"],
      me: STANDARD_PLANS["one-hand"],
    },
    planHistory: {
      habiba: [
        {
          id: "habiba-plan-change-1",
          plan: STANDARD_PLANS["one-hand"],
          appliedAt: iso(subDays(TODAY, 21)),
          scope: "beginning",
        } as PlanChangeEvent,
        {
          id: "habiba-plan-change-2",
          plan: STANDARD_PLANS["one-half-hand"],
          appliedAt: iso(subDays(TODAY, 21)),
          scope: "beginning",
          outstandingBalance: 1500,
          note: "Upgraded from One Hand. Outstanding ₦1,500 spread across remaining weeks.",
        } as PlanChangeEvent,
      ],
    },
    weeks: [],
    savings: [],
    payments: [],
    activities: [],
    notifications: [],
    createdAt: iso(subDays(TODAY, 49)),
  };

  const weeks = generateWeeks(thrift.settings);
  thrift.weeks = weeks;

  const daily: Record<string, number> = {
    hassana: 200,
    habiba: 200,
    yusuf: 400,
    junior: 200,
    me: 200,
  };

  const currentWeekId = weeks.find((w) => {
    const s = parseDay(w.startDate);
    const e = parseDay(w.endDate);
    return (
      (isSameDay(TODAY, s) || isAfter(TODAY, s)) && (isSameDay(TODAY, e) || isBefore(TODAY, e))
    );
  })?.id;

  const savings: DaySaving[] = [];
  const payments: WeekPayment[] = [];

  for (const week of weeks) {
    const isPast = isBefore(parseDay(week.endDate), TODAY);
    const isCurrent = week.id === currentWeekId;
    const weekNumber = week.number;

    for (const day of week.days) {
      const date = toStartOfDay(parseDay(day.date));
      if (isAfter(date, TODAY)) continue;
      if (!isWorkingDayLike(date)) continue;

      for (const member of members) {
        let amount = daily[member.id];
        if (member.id === "habiba" && weekNumber > 3) amount = 300;

        if (member.id === "yusuf" && weekNumber === 4 && day.index === 2) continue;
        if (member.id === "yusuf" && isCurrent && day.index === 1) continue;
        if (member.id === "junior" && weekNumber === 5 && (day.index === 3 || day.index === 4)) continue;
        if (member.id === "junior" && isCurrent && day.index === 4) continue;

        if (member.id === "hassana" && isCurrent && day.index === 3) continue;

        savings.push(makeSaving(member.id, week.id, day.date, amount));
      }
    }

    if (isPast || isCurrent) {
      for (const member of members) {
        const weeklyTarget = getWeekTarget(daily[member.id], week, member.id, weekNumber);
        if (isPast && weekNumber <= 6) {
          if (member.id === "hassana") {
            payments.push(makePayment(member.id, week.id, weeklyTarget, "approved"));
          } else if (member.id === "habiba") {
            if (weekNumber <= 4) {
              payments.push(makePayment(member.id, week.id, 1000, "approved"));
            } else {
              payments.push(makePayment(member.id, week.id, 1500, "approved"));
            }
          } else if (member.id === "yusuf") {
            if (weekNumber === 6) {
              payments.push(
                makePayment(member.id, week.id, weeklyTarget, "pending", {
                  receiptUrl: "/receipts/yusuf-week6.jpg",
                })
              );
            } else {
              payments.push(makePayment(member.id, week.id, weeklyTarget, "approved"));
            }
          } else if (member.id === "junior") {
            if (weekNumber === 5) {
              payments.push(makePayment(member.id, week.id, weeklyTarget, "pending"));
            } else if (weekNumber === 6) {
              payments.push(
                makePayment(member.id, week.id, weeklyTarget, "pending", {
                  receiptUrl: "/receipts/junior-week6.jpg",
                })
              );
            } else {
              payments.push(makePayment(member.id, week.id, weeklyTarget, "approved"));
            }
          } else {
            if (weekNumber === 6) {
              payments.push(
                makePayment(member.id, week.id, weeklyTarget, "pending", {
                  receiptUrl: "/receipts/me-week6.jpg",
                })
              );
            } else {
              payments.push(makePayment(member.id, week.id, weeklyTarget, "approved"));
            }
          }
        }
      }
    }
  }

  thrift.savings = savings;
  thrift.payments = payments;

  thrift.activities = buildActivities(thrift, members);

  thrift.notifications = [
    {
      id: "notif-1",
      userId: "me",
      type: "receipt_uploaded",
      title: "Receipt uploaded",
      body: "Your Week 6 receipt is pending admin review.",
      read: false,
      createdAt: iso(subDays(TODAY, 2)),
    },
    {
      id: "notif-2",
      userId: "me",
      type: "week_completed",
      title: "Week 6 completed!",
      body: "You completed your savings for Week 6. Keep it up!",
      read: true,
      createdAt: iso(subDays(TODAY, 4)),
    },
    {
      id: "notif-3",
      userId: "me",
      type: "saving_reminder",
      title: "Don't forget to save today",
      body: "A ₦200 contribution is due today.",
      read: true,
      createdAt: iso(subDays(TODAY, 1)),
    },
    {
      id: "notif-4",
      userId: "hassana",
      type: "payment_approval",
      title: "Payment awaiting approval",
      body: "Junior uploaded a receipt for Week 6.",
      read: false,
      createdAt: iso(subDays(TODAY, 1)),
    },
    {
      id: "notif-5",
      userId: "hassana",
      type: "payment_approval",
      title: "Payment awaiting approval",
      body: "Yusuf uploaded a receipt for Week 6.",
      read: false,
      createdAt: iso(subDays(TODAY, 1)),
    },
  ];

  return { version: 1, thrift };
}

function isWorkingDayLike(date: Date): boolean {
  const dow = date.getDay() === 0 ? 7 : date.getDay();
  return dow >= 1 && dow <= 5;
}

function getWeekTarget(
  defaultDaily: number,
  week: { days: { index: number; date: string }[] },
  memberId: string,
  weekNumber: number
): number {
  const daily = memberId === "habiba" && weekNumber > 3 ? 300 : defaultDaily;
  return daily * week.days.length;
}

function buildActivities(thrift: ThriftState, members: Member[]): ActivityEvent[] {
  const helper = (
    type: ActivityEvent["type"],
    actorId: string,
    message: string,
    daysAgo: number,
    amount?: number
  ): ActivityEvent => ({
    id: `act-${type}-${daysAgo}-${actorId}`,
    thriftId: thrift.id,
    actorId,
    type,
    message,
    amount,
    createdAt: iso(subDays(TODAY, daysAgo)),
  });

  const byName = (id: string) => members.find((m) => m.id === id)?.name ?? id;

  return [
    helper("payment_approved", "hassana", `${byName("me")}’s Week 5 payment of ₦1,000 was approved`, 6, 1000),
    helper("payment_uploaded", "me", `${byName("me")} uploaded a receipt for Week 6`, 2),
    helper("saving", "habiba", `${byName("habiba")} saved ₦300 today`, 1, 300),
    helper("plan_change", "habiba", `${byName("habiba")} upgraded to One & Half Hands`, 21),
    helper("saving", "yusuf", `${byName("yusuf")} saved ₦400 today`, 1, 400),
    helper("payment_approved", "hassana", `${byName("junior")}’s Week 4 payment was approved`, 12, 1000),
    helper("week_completed", "me", `${byName("me")} completed Week 6 savings`, 4),
    helper("saving", "hassana", `${byName("hassana")} saved ₦200 today`, 1, 200),
    helper("payment_uploaded", "junior", `${byName("junior")} uploaded a receipt for Week 6`, 1),
  ];
}

export function saveDemoProfile() {
  return {
    id: "demo-profile",
    memberId: "me",
    email: "me@thriftwise.app",
    displayName: "Me",
    createdAt: iso(subDays(TODAY, 49)),
  };
}

export { format, parseISO };
