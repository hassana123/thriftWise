"use client";

import * as React from "react";
import { Check, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useThrift } from "@/providers/thrift-provider";
import { formatMoney } from "@/lib/format";
import { getCurrentWeek } from "@/domain/calendar";
import {
  getFamilyGoal,
  getFamilySavings,
  getWeekPayment,
  getWeeklyTarget,
} from "@/domain/calculations";
import type { ThriftState } from "@/domain/types";

const GROUP_LINK = "https://chat.whatsapp.com/GqxSvRvr0i4KD6FiNaLlvC";

function buildUpdateMessage(state: ThriftState): string {
  const week = getCurrentWeek(state.weeks);
  const totalSaved = getFamilySavings(state);
  const goal = getFamilyGoal(state);
  const weeklyTotal = week
    ? state.members.reduce(
        (sum, m) => sum + (m.status === "active" ? getWeeklyTarget(state, m.id, week) : 0),
        0
      )
    : 0;
  const lines: string[] = [
    `🏝️ *${state.settings.name}*`,
    `Total saved: *${formatMoney(totalSaved)}* of *${formatMoney(goal)}* goal`,
    week ? `Current week: Week ${week.number} · *${formatMoney(weeklyTotal)}* due this week` : "",
    "",
    ...state.members.map((m) => {
      const payment = week ? getWeekPayment(state.payments, m.id, week.id) : undefined;
      const done = payment?.status === "approved";
      const amount = week ? getWeeklyTarget(state, m.id, week) : 0;
      return done ? `✅ ${m.name} — paid ${formatMoney(payment?.amount ?? amount)}` : `⏳ ${m.name} — pending`;
    }),
    "",
    `Join the group: ${GROUP_LINK}`,
    `Made with ThriftWise`,
  ];
  return lines.filter(Boolean).join("\n");
}

export function WhatsAppShareButton({
  variant = "outline",
  className,
}: {
  variant?: "outline" | "secondary" | "default";
  className?: string;
}) {
  const { state } = useThrift();
  const [copied, setCopied] = React.useState(false);

  if (!state) return null;

  const currentState = state;

  function handleShare() {
    const message = buildUpdateMessage(currentState);
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  }

  async function handleCopy() {
    const message = buildUpdateMessage(currentState);
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant={variant} size="sm" className={className} onClick={handleShare}>
        <MessageCircle className="size-4" /> Share to WhatsApp group
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={className}
        onClick={handleCopy}
        title="Copy the update message"
      >
        {copied ? <Check className="size-4 text-success" /> : null}
        {copied ? "Copied" : "Copy text"}
      </Button>
      <span className="hidden text-xs text-muted-foreground sm:block">
        Opens WhatsApp with the update ready to post in the group.
      </span>
    </div>
  );
}
