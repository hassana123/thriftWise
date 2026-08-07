/**
 * Sets a member's days-per-week and resyncs all their recorded amounts.
 *
 * Run:
 *   node scripts/set-days.mjs <memberId> <days>
 *   node scripts/set-days.mjs isah-muhammad-junior 7
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

const memberId = process.argv[2];
const days = Number(process.argv[3]);
if (!memberId || !Number.isInteger(days) || days < 1 || days > 7) {
  console.error("Usage: node scripts/set-days.mjs <memberId> <days 1-7>");
  process.exit(1);
}

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
  const d = member?.daysPerWeek ?? week.days?.length ?? 5;
  return plan ? plan.dailyAmount * d : 0;
}

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
  const member = (t.members ?? []).find((m) => m.id === memberId);
  if (!member) throw new Error(`Member ${memberId} not found`);

  member.daysPerWeek = days;

  let payments = [...(t.payments ?? [])];
  let savings = [...(t.savings ?? [])];
  const changes = [];

  for (const week of t.weeks ?? []) {
    const existing = payments.find((p) => p.memberId === memberId && p.weekId === week.id);
    if (!existing) continue;
    const target = weeklyTarget(t, memberId, week);
    if (existing.amount !== target) {
      payments = payments.map((p) =>
        p.id === existing.id ? { ...p, amount: target } : p
      );
      changes.push(`${week.id} ${existing.amount} -> ${target}`);
    }
    const dates = new Set(week.days.map((d) => d.date));
    savings = savings.filter((s) => !(s.memberId === memberId && dates.has(s.date)));
    savings = fillWeekSavings({ ...t, payments, savings }, memberId, week, target);
  }

  t.payments = payments;
  t.savings = savings;
  const { error: saveErr } = await sb
    .from("thrift_state")
    .update({ state: row.state, updated_at: new Date().toISOString() })
    .eq("id", "main");
  if (saveErr) throw saveErr;

  console.log(`✓ ${member.name} (${member.id}) days/week -> ${days}`);
  if (changes.length === 0) {
    console.log("  Amounts were already at target — no changes.");
  } else {
    changes.forEach((c) => console.log(`  ${c}`));
  }
  const totalSaved = savings.reduce((sum, s) => sum + s.amount, 0);
  console.log(`✓ Total savings now: ${totalSaved.toLocaleString()}`);
}

main().catch((err) => {
  console.error("Failed:", err.message ?? err);
  process.exit(1);
});
