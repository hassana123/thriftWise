/**
 * Adds (or updates) an admin user for ThriftWise.
 *
 * - Creates a Supabase auth user (email confirmed) with the given email/password.
 * - Links their profile to the admin member (matched by name, role, or first member)
 *   via the `profiles` table.
 * - Ensures that member in `thrift_state` is the admin with the provided name/email.
 *
 * Requires the service_role key (NOT the anon key) so it can create users.
 * Usage:
 *   $env:SUPABASE_URL="https://xyz.supabase.co"
 *   $env:SUPABASE_SERVICE_ROLE_KEY="eyJ..."
 *   node scripts/add-admin.mjs
 *
 * Values can also be overridden with --email, --password, --name:
 *   node scripts/add-admin.mjs --email hassanaabdll1@gmail.com --password 1234567890
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const i = a.indexOf("=");
    return i === -1 ? [a, true] : [a.slice(2), a.slice(i + 1)];
  })
);

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

const url = process.env.SUPABASE_URL ?? args.url;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? args["service-role-key"];

const email = args.email ?? "hassanaabdll1@gmail.com";
const password = args.password ?? "1234567890";
const name = args.name ?? "Hassana Abdullahi";
const memberId = "hassana";

if (!url || !serviceKey) {
  console.error(
    "Missing Supabase URL or service role key.\n" +
      "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars (or pass --url / --service-role-key).\n" +
      "Get the service role key from Supabase Dashboard → Project Settings → API."
  );
  process.exit(1);
}

const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

async function main() {
  // 1. Create or fetch the auth user.
  let userId;
  const { data: existing } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const found = existing?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (found) {
    userId = found.id;
    console.log(`✓ Auth user already exists (${email})`);
    const { error: updateErr } = await sb.auth.admin.updateUserById(userId, { password });
    if (updateErr) throw updateErr;
    console.log("✓ Password reset");
  } else {
    const { data, error } = await sb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name },
    });
    if (error) throw error;
    userId = data.user.id;
    console.log(`✓ Auth user created (${email})`);
  }

  // 2. Ensure the thrift state has a member to link as admin.
  let { data: stateRow } = await sb.from("thrift_state").select("state").eq("id", "main").maybeSingle();
  if (!stateRow?.state?.thrift) {
    const state = buildSeedState(memberId, name, email);
    stateRow = { state };
    const { error: seedErr } = await sb.from("thrift_state").insert({
      id: "main",
      version: 1,
      state: stateRow.state,
      updated_at: new Date().toISOString(),
    });
    if (seedErr) throw seedErr;
    console.log("✓ Seeded demo thrift state (family of five, hassana = admin)");
  }

  // Find the admin member: prefer an existing admin/role match, else first member.
  const thrift = stateRow.state.thrift;
  const members = thrift.members ?? [];
  const adminMatch =
    members.find((m) => m.role === "admin") ||
    members.find((m) => m.email?.toLowerCase() === email.toLowerCase()) ||
    members.find((m) => name.toLowerCase().split(/\s+/)[0].length > 2 && m.name?.toLowerCase().startsWith(name.toLowerCase().split(/\s+/)[0].slice(0, 4))) ||
    members[0];
  const adminId = adminMatch?.id ?? memberId;

  // 3. Link the profile to the admin member.
  const { error: profileErr } = await sb.from("profiles").upsert(
    {
      id: userId,
      member_id: adminId,
      email,
      display_name: name,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  if (profileErr) throw profileErr;
  console.log(`✓ Profile linked to member "${adminId}"`);

  // 4. Ensure the admin member has the right role/name/email in state.
  {
    const updated = members.map((m) =>
      m.id === adminId ? { ...m, role: "admin", name, email } : m
    );
    if (updated.find((m) => m.id === adminId) === undefined) {
      updated.push({
        id: adminId,
        name,
        email,
        role: "admin",
        color: "#16A34A",
        status: "active",
        joinedAt: new Date().toISOString().slice(0, 10),
      });
    }
    thrift.members = updated;
    if (thrift.settings?.paymentAccount?.accountName === "Hassana Abdullahi") {
      thrift.settings.paymentAccount.accountName = name;
    }
    const { error: stateErr } = await sb
      .from("thrift_state")
      .update({ state: stateRow.state, updated_at: new Date().toISOString() })
      .eq("id", "main");
    if (stateErr) throw stateErr;
    console.log(`✓ Thrift state updated (${adminId} = admin)`);
  }

  // 5. Backfill historical savings/payments if the state is empty.
  if ((thrift.savings?.length ?? 0) === 0 && (thrift.payments?.length ?? 0) === 0) {
    backfillHistory(thrift);
    const { error: backfillErr } = await sb
      .from("thrift_state")
      .update({ state: stateRow.state, updated_at: new Date().toISOString() })
      .eq("id", "main");
    if (backfillErr) throw backfillErr;
    console.log("✓ Backfilled savings & payments for past weeks");
  }

  console.log("\nDone. Sign in with:");
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);
}

function backfillHistory(thrift) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const fmt = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
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

function buildSeedState(adminId, adminName, adminEmail) {
  const startOfWeek = (d) => {
    const x = new Date(d);
    const day = (x.getDay() + 6) % 7;
    x.setDate(x.getDate() - day);
    x.setHours(0, 0, 0, 0);
    return x;
  };
  const fmt = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  const addDays = (d, n) => new Date(d.getTime() + n * 86400000);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDate = addDays(startOfWeek(today), -42);
  const vacationDate = addDays(startOfWeek(today), 84);

  const members = [
    { id: adminId, name: adminName, email: adminEmail, role: "admin", color: "#16A34A", status: "active", joinedAt: fmt(addDays(today, -49)) },
    { id: "habiba", name: "Habiba", email: "habiba@thriftwise.app", role: "member", color: "#F59E0B", status: "active", joinedAt: fmt(addDays(today, -49)) },
    { id: "yusuf", name: "Yusuf", email: "yusuf@thriftwise.app", role: "member", color: "#6366F1", status: "active", joinedAt: fmt(addDays(today, -49)) },
    { id: "junior", name: "Junior", email: "junior@thriftwise.app", role: "member", color: "#EC4899", status: "active", joinedAt: fmt(addDays(today, -49)) },
    { id: "me", name: "Me", email: "me@thriftwise.app", role: "member", color: "#06B6D4", status: "active", joinedAt: fmt(addDays(today, -49)) },
  ];

  const standardPlans = {
    "one-hand": { key: "one-hand", label: "One Hand", dailyAmount: 200, weeklyAmount: 1000, monthlyAmount: 4000 },
    "one-half-hand": { key: "one-half-hand", label: "1½ Hands", dailyAmount: 300, weeklyAmount: 1500, monthlyAmount: 6000 },
    "two-hands": { key: "two-hands", label: "Two Hands", dailyAmount: 400, weeklyAmount: 2000, monthlyAmount: 8000 },
  };

  const workingDays = [1, 2, 3, 4, 5];
  const weeks = [];
  let cursor = startOfWeek(startDate);
  let number = 1;
  while (cursor <= startOfWeek(vacationDate)) {
    const days = [];
    for (const dow of workingDays) {
      const dayDate = addDays(cursor, dow - 1);
      if (dayDate >= startDate && dayDate < vacationDate) {
        days.push({ date: fmt(dayDate), index: days.length });
      }
    }
    if (days.length > 0) {
      weeks.push({ id: `week-${number}`, number, startDate: days[0].date, endDate: days[days.length - 1].date, days });
      number += 1;
    }
    cursor = addDays(cursor, 7);
  }

  const memberIds = members.map((m) => m.id);
  const daily = Object.fromEntries(memberIds.map((id) => [id, (standardPlans[id === "yusuf" ? "two-hands" : "one-hand"] || standardPlans["one-hand"]).dailyAmount]));
  const savings = [];
  const payments = [];
  for (const week of weeks) {
    const isPast = week.endDate < fmt(today);
    const isCurrent = week.startDate <= fmt(today) && fmt(today) <= week.endDate;
    for (const day of week.days) {
      if (day.date >= fmt(today)) continue;
      for (const id of memberIds) {
        savings.push({ id: `${id}-${day.date}`, memberId: id, weekId: week.id, date: day.date, amount: daily[id] });
      }
    }
    if (isPast || isCurrent) {
      for (const id of memberIds) {
        const weekly = daily[id] * week.days.length;
        payments.push({
          id: `${id}-${week.id}`,
          memberId: id,
          weekId: week.id,
          amount: weekly,
          status: isPast ? "approved" : "pending",
          method: "manual",
          receiptStatus: isPast ? "approved" : undefined,
          createdAt: week.startDate + "T18:00:00.000Z",
          approvedAt: isPast ? week.endDate + "T18:00:00.000Z" : undefined,
        });
      }
    }
  }

  return {
    version: 1,
    thrift: {
      id: "demo-thrift",
      settings: {
        name: "December Family Vacation",
        startDate: fmt(startDate),
        vacationDate: fmt(vacationDate),
        workingDays,
        defaultDailyAmount: 200,
        currency: "NGN",
        paymentAccount: { bank: "OPay", accountName: adminName, accountNumber: "8102920194" },
      },
      members,
      memberPlans: {
        [adminId]: standardPlans["one-hand"],
        habiba: standardPlans["one-hand"],
        yusuf: standardPlans["two-hands"],
        junior: standardPlans["one-hand"],
        me: standardPlans["one-hand"],
      },
      planHistory: {},
      weeks,
      savings,
      payments,
      activities: [],
      notifications: [],
      createdAt: fmt(addDays(today, -49)),
    },
  };
}

main().catch((err) => {
  console.error("Failed:", err.message ?? err);
  process.exit(1);
});
