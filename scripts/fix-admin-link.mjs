/**
 * Fixes the admin's Supabase profile link and backfills empty savings/payments.
 *
 * Run:
 *   node scripts/fix-admin-link.mjs
 *
 * - Relinks every profile whose member_id no longer exists in thrift_state to
 *   the current admin member (matches by role, then name, then first member).
 * - If the state has no savings and no payments, backfills them for all past
 *   (and the current) weeks so the dashboard/savings/payments pages have data.
 *
 * Requires SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_URL)
 * in .env. Does not require the anon policies — those must be applied via the
 * Supabase SQL editor using supabase/anon-policies.sql.
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

function fmt(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function backfillHistory(thrift) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const savings = [];
  const payments = [];
  for (const week of thrift.weeks ?? []) {
    const isPast = week.endDate < fmt(today);
    const isCurrent = week.startDate <= fmt(today) && fmt(today) <= week.endDate;
    if (!isPast && !isCurrent) continue;
    for (const member of thrift.members ?? []) {
      const plan = thrift.memberPlans?.[member.id] ?? thrift.memberPlans?.[thrift.members[0]?.id];
      const daily = plan?.dailyAmount ?? thrift.settings?.defaultDailyAmount ?? 200;
      for (const day of week.days ?? []) {
        if (day.date >= fmt(today)) continue;
        savings.push({ id: `${member.id}-${day.date}`, memberId: member.id, weekId: week.id, date: day.date, amount: daily });
      }
      const weekly = daily * (week.days?.length ?? 0);
      payments.push({
        id: `${member.id}-${week.id}`,
        memberId: member.id,
        weekId: week.id,
        amount: weekly,
        status: isPast ? "approved" : "pending",
        method: "manual",
        receiptStatus: isPast ? "approved" : undefined,
        createdAt: `${week.startDate}T18:00:00.000Z`,
        approvedAt: isPast ? `${week.endDate}T18:00:00.000Z` : undefined,
      });
    }
  }
  thrift.savings = savings;
  thrift.payments = payments;
}

async function main() {
  const { data: row, error: loadErr } = await sb
    .from("thrift_state")
    .select("state")
    .eq("id", "main")
    .maybeSingle();
  if (loadErr) throw loadErr;
  if (!row?.state?.thrift) throw new Error("No thrift state found (id=main)");

  const thrift = row.state.thrift;
  const members = thrift.members ?? [];

  // 1. Relink stale profiles to the admin member.
  const admin =
    members.find((m) => m.role === "admin") ??
    members.find((m) => m.email) ??
    members[0];
  if (!admin) throw new Error("Thrift has no members to link");

  const { data: profiles } = await sb.from("profiles").select("id, member_id, display_name");
  let relinked = 0;
  for (const p of profiles ?? []) {
    const exists = members.some((m) => m.id === p.member_id);
    if (exists) continue;
    const { error: upErr } = await sb
      .from("profiles")
      .update({ member_id: admin.id, updated_at: new Date().toISOString() })
      .eq("id", p.id);
    if (upErr) throw upErr;
    console.log(`✓ Relinked profile ${p.id} → "${admin.id}" (was "${p.member_id}")`);
    relinked += 1;
  }
  if (relinked === 0) console.log(`✓ Profiles already linked to ${admin.id}`);

  // 2. Backfill empty savings/payments.
  if ((thrift.savings?.length ?? 0) === 0 && (thrift.payments?.length ?? 0) === 0) {
    backfillHistory(thrift);
    const { error: saveErr } = await sb
      .from("thrift_state")
      .update({ state: row.state, updated_at: new Date().toISOString() })
      .eq("id", "main");
    if (saveErr) throw saveErr;
    console.log(`✓ Backfilled ${thrift.savings.length} savings and ${thrift.payments.length} payments`);
  } else {
    console.log("✓ State already has savings/payments — backfill skipped");
  }

  console.log("\nDone. Now sign out and sign back in (or just refresh) to see your dashboard as the admin.");
  console.log("If family name sign-in is still empty, run supabase/anon-policies.sql in the Supabase SQL editor.");
}

main().catch((err) => {
  console.error("Failed:", err.message ?? err);
  process.exit(1);
});
