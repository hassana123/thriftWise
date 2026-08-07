export type Role = "admin" | "member";
export type MemberStatus = "active" | "suspended" | "invited";
export type WeekStatus = "upcoming" | "current" | "past";
export type PaymentStatus = "pending" | "approved" | "rejected" | "overdue";
export type ReceiptStatus = "pending" | "approved" | "rejected";

export interface PaymentAccount {
  bank: string;
  accountName: string;
  accountNumber: string;
}

export interface ThriftSettings {
  name: string;
  startDate: string;
  vacationDate: string;
  workingDays: number[];
  defaultDailyAmount: number;
  paymentAccount: PaymentAccount;
  currency: "NGN";
  timezone?: string;
}

export interface Member {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role: Role;
  color: string;
  status: MemberStatus;
  joinedAt: string;
  daysPerWeek?: number;
}

export type PlanKey = "one-hand" | "one-half-hand" | "two-hands" | "custom";

export interface ContributionPlan {
  key: PlanKey;
  label: string;
  description?: string;
  dailyAmount: number;
  weeklyAmount: number;
  monthlyAmount: number;
}

export interface PlanChangeEvent {
  id: string;
  plan: ContributionPlan;
  previousPlan?: ContributionPlan;
  appliedAt: string;
  effectiveFrom?: string;
  scope: "today" | "next-week" | "beginning";
  outstandingBalance?: number;
  note?: string;
}

export interface MemberPlan {
  memberId: string;
  plan: ContributionPlan;
  planHistory: PlanChangeEvent[];
}

export interface ThriftWeekDay {
  date: string;
  index: number;
}

export interface ThriftWeek {
  id: string;
  number: number;
  startDate: string;
  endDate: string;
  days: ThriftWeekDay[];
}

export interface DaySaving {
  id: string;
  memberId: string;
  weekId: string;
  date: string;
  amount: number;
}

export interface WeekPayment {
  id: string;
  memberId: string;
  weekId: string;
  amount: number;
  status: PaymentStatus;
  method: "transfer" | "manual";
  receiptUrl?: string;
  receiptStatus?: ReceiptStatus;
  adminNote?: string;
  paidAt?: string;
  approvedAt?: string;
  createdAt: string;
}

export interface ActivityEvent {
  id: string;
  thriftId: string;
  actorId: string;
  type:
    | "saving"
    | "payment_uploaded"
    | "payment_approved"
    | "payment_rejected"
    | "plan_change"
    | "member_joined"
    | "week_completed"
    | "receipt_requested";
  message: string;
  amount?: number;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type:
    | "saving_reminder"
    | "behind_target"
    | "transfer_reminder"
    | "receipt_uploaded"
    | "payment_approval"
    | "payment_approved"
    | "payment_rejected"
    | "week_completed"
    | "system";
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

export interface ThriftState {
  id: string;
  settings: ThriftSettings;
  members: Member[];
  memberPlans: Record<string, ContributionPlan>;
  planHistory: Record<string, PlanChangeEvent[]>;
  weeks: ThriftWeek[];
  savings: DaySaving[];
  payments: WeekPayment[];
  activities: ActivityEvent[];
  notifications: Notification[];
  createdAt: string;
}

export interface AppState {
  version: number;
  thrift: ThriftState;
}

export type PlanChangeScope = "today" | "next-week" | "beginning";

export interface OnboardingInput {
  name: string;
  startDate: string;
  vacationDate: string;
  workingDays: number[];
  defaultDailyAmount: number;
  paymentAccount: PaymentAccount;
  members: { name: string; email?: string; role: Role }[];
  creatorName: string;
  creatorEmail: string;
}

export interface AuthProfile {
  id: string;
  memberId: string;
  email: string;
  displayName: string;
  photoUrl?: string;
  createdAt: string;
}
