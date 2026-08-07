"use client";

import * as React from "react";
import { Plane, Wallet } from "lucide-react";
import { format } from "date-fns";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StaggerItem } from "@/components/page-transition";
import { WeeklyPaymentCard } from "@/components/dashboard/weekly-payment-card";
import { LedgerPreview } from "@/components/dashboard/ledger-preview";
import { ConfirmPayments } from "@/components/dashboard/confirm-payments";
import { WhatsAppShareButton } from "@/components/dashboard/whatsapp-share-button";
import { useThrift } from "@/providers/thrift-provider";
import { useAuth } from "@/providers/auth-provider";
import { initials, formatMoney } from "@/lib/format";
import { getFamilyGoal } from "@/domain/calculations";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const { state, isReady } = useThrift();
  const { member } = useAuth();

  if (!isReady || !state || !member) {
    return <DashboardSkeleton />;
  }

  const isAdmin = member.role === "admin";
  const familyGoal = getFamilyGoal(state);
  const daysLeft = Math.max(
    0,
    Math.ceil((new Date(state.settings.vacationDate).getTime() - new Date().getTime()) / 86400000)
  );

  return (
    <div className="space-y-6">
      <StaggerItem>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar className="size-12 ring-2 ring-primary/20 sm:size-14">
              <AvatarFallback style={{ backgroundColor: member.color }} className="text-base text-white sm:text-lg">
                {initials(member.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm text-muted-foreground">
                {format(new Date(), "EEEE, MMMM d")}
              </p>
              <h2 className="truncate text-xl font-bold tracking-tight sm:text-2xl">
                {greeting()}, {member.name.split(" ")[0]}!
              </h2>
              <p className="truncate text-sm text-muted-foreground">
                {state.settings.name} · goal {formatMoney(familyGoal)}
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="gap-1.5 px-3 py-1.5">
            <Plane className="size-3.5" />
            {daysLeft} {daysLeft === 1 ? "day" : "days"} to go
          </Badge>
        </div>
        {isAdmin ? (
          <div className="mt-3">
            <WhatsAppShareButton />
          </div>
        ) : null}
      </StaggerItem>

      <WeeklyPaymentCard />

      {isAdmin ? <ConfirmPayments /> : null}

      <LedgerPreview />

      <p className="flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
        <Wallet className="size-3.5" />
        {isAdmin
          ? "Transfer account shown above — confirm members once they've paid."
          : "Transfer to the account above, then upload your receipt to confirm this week."}
      </p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-64" />
      </div>
      <Skeleton className="h-64 rounded-3xl" />
      <Skeleton className="h-40 rounded-2xl" />
      <Skeleton className="h-72 rounded-2xl" />
    </div>
  );
}
