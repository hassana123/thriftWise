"use client";

import * as React from "react";
import { Wallet } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { StaggerItem } from "@/components/page-transition";
import { WeeklyPaymentCard } from "@/components/dashboard/weekly-payment-card";
import { LedgerPreview } from "@/components/dashboard/ledger-preview";
import { ConfirmPayments } from "@/components/dashboard/confirm-payments";
import { WhatsAppShareButton } from "@/components/dashboard/whatsapp-share-button";
import { useThrift } from "@/providers/thrift-provider";
import { useAuth } from "@/providers/auth-provider";

export default function DashboardPage() {
  const { state, isReady } = useThrift();
  const { member } = useAuth();

  if (!isReady || !state || !member) {
    return <DashboardSkeleton />;
  }

  const isAdmin = member.role === "admin";

  return (
    <div className="space-y-2">
      {isAdmin ? (
        <StaggerItem>
          <WhatsAppShareButton />
        </StaggerItem>
      ) : null}

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
    <div className="space-y-2">
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
