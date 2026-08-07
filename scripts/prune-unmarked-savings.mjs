/**
 * Reverses savings entries left behind when a marked-paid week was unmarked.
 *
 * The app now keeps day-by-day savings in lockstep with the ledger: marking a
 * week paid creates savings, unmarking/rejecting removes them. Earlier versions
 * only flipped the payment status, so unmarked weeks still showed their money
 * in balances and totals. This removes savings for every member+week whose
 * payment record is not "approved", bringing "total saved" back to what the
 * ledger actually confirms.
 *
 * Idempotent — re-running produces no further changes.
 *
 * Run:
 *   node scripts/prune-unmarked-savings.mjs
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

async function main() {
  const { data: row, error } = await sb
    .from("thrift_state")
    .select("state")
    .eq("id", "main")
    .maybeSingle();
  if (error) throw error;
  if (!row?.state?.thrift) throw new Error("No thrift state found");

  const t = row.state.thrift;
  let savings = [...(t.savings ?? [])];
  const removed = [];

  for (const week of t.weeks ?? []) {
    const weekDates = new Set(week.days.map((d) => d.date));
    const toRemove = savings.filter(
      (s) => weekDates.has(s.date) && !hasApproved(t, s.memberId, week.id)
    );
    if (toRemove.length === 0) continue;
    removed.push(
      `${toRemove[0].memberId} · W${week.number}: removed ${toRemove.length} day(s) totalling ${toRemove
        .reduce((sum, s) => sum + s.amount, 0)
        .toLocaleString()}`
    );
    savings = savings.filter((s) => !weekDates.has(s.date) || hasApproved(t, s.memberId, week.id));
  }

  if (removed.length === 0) {
    console.log("Nothing to prune — all savings already match approved payments.");
    return;
  }

  t.savings = savings;
  const { error: saveErr } = await sb
    .from("thrift_state")
    .update({ state: row.state, updated_at: new Date().toISOString() })
    .eq("id", "main");
  if (saveErr) throw saveErr;

  const totalSaved = savings.reduce((sum, s) => sum + s.amount, 0);
  console.log(`✓ Removed savings for ${removed.length} week(s):`);
  removed.forEach((r) => console.log(`   ${r}`));
  console.log(`✓ Total savings now: ${totalSaved.toLocaleString()}`);
}

function hasApproved(t, memberId, weekId) {
  return (t.payments ?? []).some(
    (p) => p.memberId === memberId && p.weekId === weekId && p.status === "approved"
  );
}

main().catch((err) => {
  console.error("Failed:", err.message ?? err);
  process.exit(1);
});
