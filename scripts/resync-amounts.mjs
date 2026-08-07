/**
 * Resyncs recorded payment amounts and day-by-day savings for every member
 * against their current plan history and days-per-week setting.
 *
 * Fixes stale values left behind by earlier plan/days changes: e.g. a week
 * marked paid at the old plan's amount, or savings spread at the old daily
 * rate. After this, "total saved" and every weekly amount match the plan.
 *
 * Idempotent — re-running produces no further changes.
 *
 * Run:
 *   node scripts/resync-amounts.mjs
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  try {
    const raw = readFileSync(".env", "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+)$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].trim();
    }
    if (!process.env.SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_URL) {
      process.env.SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    }
  } catch {
    /* no .env */
  }
}
loadEnv();

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

function parseDay(day) {
  return new Date(`${day}T00:00:00`);
}

// Mirrors src/domain/calculations.ts getPlanForWeek: the latest plan-change
// event whose effectiveFrom is on/before the week's start wins; otherwise the
// oldest event's previousPlan (or the current memberPlans entry).
function planForWeek(state, memberId, week) {
  const events = (state.planHistory?.[memberId] ?? [])
    .map((e) => ({
      plan: e.plan,
      previousPlan: e.previousPlan,
      effectiveFrom: e.effectiveFrom ? parseDay(e.effectiveFrom) : new Date(NaN),
    }))
    .filter((e) => !Number.isNaN(e.effectiveFrom.getTime()))
    .sort((a, b) => a.effectiveFrom.getTime() - b.effectiveFrom.getTime());
  if (events.length === 0) return state.memberPlans?.[memberId];
  const weekStart = parseDay(week.startDate).getTime();
  let applied = null;
  for (const e of events) {
    if (e.effectiveFrom.getTime() <= weekStart) applied = e.plan;
    else break;
  }
  if (applied) return applied;
  return events[0].previousPlan ?? state.memberPlans?.[memberId];
}

function weeklyTarget(state, memberId, week) {
  const plan = planForWeek(state, memberId, week);
  const member = (state.members ?? []).find((m) => m.id === memberId);
  const days = member?.daysPerWeek ?? week.days?.length ?? 5;
  return plan ? plan.dailyAmount * days : 0;
}

// Spreads `amount` across the week's days that have no savings yet (same as
// fillWeekSavings in the app).
function fillWeekSavings(state, memberId, week, amount) {
  if (amount <= 0) return state.savings;
  const dates = new Set(week.days.map((d) => d.date));
  const alreadySaved = new Set(
    state.savings.filter((s) => s.memberId === memberId && dates.has(s.date)).map((s) => s.date)
  );
  const missing = week.days.filter((d) => !alreadySaved.has(d.date));
  if (missing.length === 0) return state.savings;
  const base = Math.floor(amount / missing.length);
  const remainder = amount - base * missing.length;
  const extra = missing.map((d, i) => ({
    id: `${memberId}-${d.date}`,
    memberId,
    weekId: week.id,
    date: d.date,
    amount: base + (i === missing.length - 1 ? remainder : 0),
  }));
  return [...state.savings, ...extra];
}

async function main() {
  const { data: row, error } = await sb
    .from("thrift_state")
    .select("state")
    .eq("id", "main")
    .maybeSingle();
  if (error) throw error;
  if (!row?.state?.thrift) throw new Error("No thrift state found");

  const t = row.state.thrift;
  let payments = [...(t.payments ?? [])];
  let savings = [...(t.savings ?? [])];
  const changes = [];

  for (const member of t.members ?? []) {
    for (const week of t.weeks ?? []) {
      const existing = payments.find(
        (p) => p.memberId === member.id && p.weekId === week.id
      );
      if (!existing) continue;
      const target = weeklyTarget(t, member.id, week);
      if (existing.amount !== target) {
        payments = payments.map((p) =>
          p.id === existing.id ? { ...p, amount: target } : p
        );
        changes.push(`${member.id} · ${week.id} amount ${existing.amount} -> ${target}`);
      }
      const dates = new Set(week.days.map((d) => d.date));
      savings = savings.filter((s) => !(s.memberId === member.id && dates.has(s.date)));
      savings = fillWeekSavings(
        { ...t, payments, savings },
        member.id,
        week,
        target
      );
    }
  }

  if (changes.length === 0) {
    console.log("Nothing to resync — all recorded amounts already match the plans.");
    return;
  }

  t.payments = payments;
  t.savings = savings;
  const { error: saveErr } = await sb
    .from("thrift_state")
    .update({ state: row.state, updated_at: new Date().toISOString() })
    .eq("id", "main");
  if (saveErr) throw saveErr;

  const totalSaved = savings.reduce((sum, s) => sum + s.amount, 0);
  const transferred = payments
    .filter((p) => p.status === "approved")
    .reduce((sum, p) => sum + p.amount, 0);
  console.log(`✓ Updated ${changes.length} payment amount(s)`);
  changes.forEach((c) => console.log(`   ${c}`));
  console.log(`✓ Savings re-spread per member/week`);
  console.log(`✓ Total savings now: ${totalSaved.toLocaleString()}`);
  console.log(`✓ Total transferred (approved): ${transferred.toLocaleString()}`);
}

main().catch((err) => {
  console.error("Failed:", err.message ?? err);
  process.exit(1);
});
