/**
 * Backfills daily savings for members/weeks that already have an approved
 * payment (marked paid manually or from the admin panel) but no savings rows.
 *
 * This makes "total saved so far" on the dashboard reflect paid weeks.
 * It is idempotent: members/weeks that already have savings are left alone.
 *
 * Run:
 *   node scripts/backfill-savings.mjs
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
  const savings = [...(t.savings ?? [])];
  const added = [];

  for (const payment of t.payments ?? []) {
    if (payment.status !== "approved") continue;
    const week = (t.weeks ?? []).find((w) => w.id === payment.weekId);
    if (!week?.days?.length) continue;
    const hasSavings = savings.some(
      (s) => s.memberId === payment.memberId && s.weekId === payment.weekId
    );
    if (hasSavings) continue;

    const days = week.days;
    const base = Math.floor(payment.amount / days.length);
    const remainder = payment.amount - base * days.length;
    days.forEach((day, i) => {
      const amount = base + (i === days.length - 1 ? remainder : 0);
      savings.push({
        id: `${payment.memberId}-${day.date}`,
        memberId: payment.memberId,
        weekId: payment.weekId,
        date: day.date,
        amount,
      });
      added.push(`${payment.memberId} · ${day.date} · ${amount}`);
    });
  }

  if (added.length === 0) {
    console.log("No approved payments missing savings — nothing to backfill.");
    return;
  }

  t.savings = savings;
  const { error: saveErr } = await sb
    .from("thrift_state")
    .update({ state: row.state, updated_at: new Date().toISOString() })
    .eq("id", "main");
  if (saveErr) throw saveErr;

  const totalSaved = savings.reduce((sum, s) => sum + s.amount, 0);
  const transferred = (t.payments ?? [])
    .filter((p) => p.status === "approved")
    .reduce((sum, p) => sum + p.amount, 0);
  console.log(`✓ Added ${added.length} savings records`);
  console.log(`✓ Total savings now: ${totalSaved.toLocaleString()}`);
  console.log(`✓ Total transferred (approved): ${transferred.toLocaleString()}`);
  console.log(`✓ Outstanding for past weeks: ${Math.max(0, totalSaved - transferred).toLocaleString()}`);
}

main().catch((err) => {
  console.error("Failed:", err.message ?? err);
  process.exit(1);
});
