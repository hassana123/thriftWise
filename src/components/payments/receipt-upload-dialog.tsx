"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  CalendarDays,
  Check,
  ImagePlus,
  Loader2,
  PartyPopper,
  ReceiptText,
  ShieldCheck,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, namesMatch } from "@/lib/utils";
import { formatMoney } from "@/lib/format";
import { useThrift } from "@/providers/thrift-provider";
import { useAuth } from "@/providers/auth-provider";
import { getMemberPlan, planDayCoverage } from "@/domain/calculations";
import { useConfetti } from "@/components/confetti";
import { uploadReceipt } from "@/lib/upload";
import { CopyButton } from "@/components/copy-button";

const DEFAULT_DAYS = 5;

export function ReceiptUploadDialog({
  open,
  onOpenChange,
  weekId,
  weekNumber,
  amount,
  account,
  currentWeekNumber,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  weekId: string;
  weekNumber: number;
  amount: number;
  account: { bank: string; accountName: string; accountNumber: string };
  currentWeekNumber?: number;
}) {
  const { uploadReceipt: saveReceipt, state } = useThrift();
  const { member } = useAuth();
  const fireConfetti = useConfetti();

  const [confirmed, setConfirmed] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [receiptAmount, setReceiptAmount] = React.useState<string>("");
  const [senderName, setSenderName] = React.useState("");
  const [accountNumber, setAccountNumber] = React.useState("");
  const [uploading, setUploading] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [wasAutoApproved, setWasAutoApproved] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setConfirmed(false);
      setFile(null);
      setReceiptAmount(amount > 0 ? String(amount) : "");
      setSenderName(member?.name ?? "");
      setAccountNumber(account.accountNumber);
      setUploading(false);
      setDone(false);
      setWasAutoApproved(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const enteredAmount = React.useMemo(() => {
    const num = parseFloat(receiptAmount);
    return Number.isFinite(num) && num > 0 ? num : 0;
  }, [receiptAmount]);

  const dailyRate = React.useMemo(() => {
    if (!state || !member) return 0;
    return getMemberPlan(state, member.id)?.dailyAmount ?? 0;
  }, [state, member]);

  // The amount decides how many days are covered (₦2100 at ₦300/day = 7 days).
  // Typing an amount always drives the day count — it can never drift apart.
  const effectiveDays = React.useMemo(() => {
    if (enteredAmount > 0 && dailyRate > 0) return Math.max(1, Math.round(enteredAmount / dailyRate));
    return DEFAULT_DAYS;
  }, [enteredAmount, dailyRate]);

  // Preview exactly which working days this payment would cover, starting from
  // the earliest unpaid day. Already-paid days are skipped, so a second upload
  // for the same week tops up the leftovers instead of double-counting them.
  const coverage = React.useMemo(() => {
    if (!state || !member) return [];
    if (enteredAmount <= 0) return [];
    return planDayCoverage(state, member.id, weekId, enteredAmount);
  }, [state, member, weekId, enteredAmount]);

  const startWeekMissing = React.useMemo(() => {
    if (!state || !member) return 0;
    const week = state.weeks.find((w) => w.id === weekId);
    if (!week) return 0;
    const covered = new Set(
      state.savings.filter((s) => s.memberId === member.id).map((s) => s.date)
    );
    return week.days.filter((d) => !covered.has(d.date)).length;
  }, [state, member, weekId]);

  const coverageLabel = React.useMemo(() => {
    if (coverage.length === 0) {
      if (enteredAmount > 0) return "already-covered days only";
      return `${DEFAULT_DAYS} days`;
    }
    return coverage
      .map((c) => `${c.dates.length} day${c.dates.length === 1 ? "" : "s"} of Week ${c.week.number}`)
      .join(" and ");
  }, [coverage, enteredAmount]);

  const nameOk = React.useMemo(
    () => Boolean(member) && namesMatch(senderName, member?.name ?? ""),
    [senderName, member]
  );
  const amountOk = enteredAmount > 0;
  const accountOk = React.useMemo(
    () => accountNumber.replace(/\s+/g, "") === account.accountNumber.replace(/\s+/g, ""),
    [accountNumber, account.accountNumber]
  );
  const allVerified = nameOk && amountOk && accountOk;

  const isPastWeek = Boolean(currentWeekNumber && weekNumber < currentWeekNumber);

  async function handleSubmit() {
    if (!member || !file) return;
    setUploading(true);
    try {
      const url = await uploadReceipt(file, member.id, weekId);
      saveReceipt(member.id, weekId, url, enteredAmount || undefined, allVerified, effectiveDays);
      setWasAutoApproved(allVerified);
      setDone(true);
      fireConfetti();
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] max-w-xl flex-col gap-5 overflow-hidden sm:max-h-[88vh]">
        <DialogHeader className="shrink-0 text-left">
          <DialogTitle>Complete your transfer</DialogTitle>
          <DialogDescription>Week {weekNumber} contribution</DialogDescription>
        </DialogHeader>

        {done ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-4 overflow-y-auto py-6 text-center"
          >
            <div className="flex size-20 items-center justify-center rounded-full bg-success/15">
              <PartyPopper className="size-10 text-primary" />
            </div>
            <div>
              <p className="text-lg font-bold">
                {wasAutoApproved
                  ? isPastWeek
                    ? "Past week settled!"
                    : "Payment confirmed!"
                  : "Receipt submitted!"}
              </p>
              <p className="text-sm text-muted-foreground">
                {wasAutoApproved ? (
                  <>
                    All details matched — your payment is now{" "}
                    <span className="font-semibold text-foreground">marked as paid</span> for{" "}
                    <span className="font-semibold text-foreground">{coverageLabel}</span>.
                    {isPastWeek
                      ? " This past week is now up to date."
                      : " No review needed."}
                  </>
                ) : (
                  <>
                    Your payment for{" "}
                    <span className="font-semibold text-foreground">{coverageLabel}</span> is now{" "}
                    <span className="font-semibold text-foreground">pending review</span>.
                    {isPastWeek
                      ? " The admin will approve it shortly to clear this past week."
                      : " The admin will approve it shortly."}
                  </>
                )}
              </p>
            </div>
            <Button className="w-full" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </motion.div>
        ) : (
          <div className="min-h-0 space-y-4 overflow-y-auto overscroll-contain pr-1">
            <div className="space-y-2 rounded-2xl border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Amount on the receipt</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Open your bank&apos;s transfer receipt and type the{" "}
                    <span className="font-semibold text-foreground">exact amount</span> it shows —
                    that amount is what gets recorded.
                  </p>
                </div>
                <ReceiptText className="size-5 shrink-0 text-primary" />
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-bold text-muted-foreground">
                  ₦
                </span>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  className="h-12 pl-9 text-2xl font-bold"
                  value={receiptAmount}
                  onChange={(e) => setReceiptAmount(e.target.value)}
                  placeholder={formatMoney(amount)}
                />
              </div>
              <p
                className={cn(
                  "text-xs",
                  enteredAmount > 0 ? "text-success" : "text-warning"
                )}
              >
                {enteredAmount > 0
                  ? `Got it — ${formatMoney(enteredAmount)} will be recorded.`
                  : "Don’t guess: check the receipt and type the amount exactly as shown."}
              </p>
            </div>

            <div className="space-y-2 rounded-2xl border p-4">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <CalendarDays className="size-4 text-primary" /> Days this covers
              </p>
              <p className="text-xs text-muted-foreground">
                {dailyRate > 0 ? (
                  <>
                    {formatMoney(dailyRate)} per working day. The amount decides the day count — it
                    updates automatically as you type, and already-paid days are skipped so nothing
                    is double-counted.
                  </>
                ) : (
                  "Already-paid days are skipped so nothing is double-counted."
                )}
              </p>

              <div className="grid grid-cols-4 gap-1.5">
                {[5, 7, 10, 15].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => dailyRate > 0 && setReceiptAmount(String(d * dailyRate))}
                    className={cn(
                      "rounded-xl border-2 py-2 text-sm font-bold transition-all",
                      effectiveDays === d
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40"
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Days covered:</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={String(effectiveDays)}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    const d = Number.isFinite(v) && v > 0 ? v : 1;
                    if (dailyRate > 0) setReceiptAmount(String(d * dailyRate));
                  }}
                  className="h-9 w-20 text-center font-bold"
                />
              </div>

              {enteredAmount > 0 ? (
                coverage.length > 0 ? (
                  <div className="space-y-1.5">
                    {coverage.map((c) => {
                      const completesWeek =
                        c.week.id === weekId &&
                        c.dates.length === startWeekMissing &&
                        startWeekMissing > 0;
                      return (
                        <div
                          key={c.week.id}
                          className="flex items-center justify-between rounded-xl bg-secondary/60 px-3 py-2 text-xs font-medium"
                        >
                          <span>
                            Week {c.week.number}
                            {completesWeek ? (
                              <span className="ml-1.5 text-success">· completes this week</span>
                            ) : c.week.id !== weekId ? (
                              <span className="ml-1.5 text-muted-foreground">
                                · rolls into next week
                              </span>
                            ) : null}
                          </span>
                          <span className="flex items-center gap-1 text-primary">
                            <Check className="size-3.5" strokeWidth={3} />
                            {c.dates.length} day{c.dates.length === 1 ? "" : "s"}
                          </span>
                        </div>
                      );
                    })}
                    <p className="text-[11px] text-muted-foreground">
                      Covers the earliest unpaid days first — weekends are never counted.
                    </p>
                  </div>
                ) : (
                  <p className="rounded-xl bg-secondary/60 px-3 py-2 text-xs font-medium">
                    Already covered — this amount won’t add any new days.
                  </p>
                )
              ) : (
                <p className="rounded-xl bg-secondary/60 px-3 py-2 text-xs font-medium">
                  Type an amount above to see exactly which days it covers.
                </p>
              )}
            </div>

            <div className="space-y-2 rounded-2xl border p-4">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck className="size-4 text-primary" /> Auto-verification
              </p>

              <div>
                <p className="mb-1 text-xs text-muted-foreground">Sender name on receipt</p>
                <Input
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="Your name as it appears on the receipt"
                />
                <p
                  className={cn(
                    "mt-1 text-xs",
                    nameOk ? "text-success" : "text-warning"
                  )}
                >
                  {nameOk
                    ? "Matches your account name."
                    : "Does not match your account name yet."}
                </p>
              </div>

              <div>
                <p className="mb-1 text-xs text-muted-foreground">Account number it was sent to</p>
                <Input
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  inputMode="numeric"
                  placeholder={account.accountNumber}
                />
                <p
                  className={cn(
                    "mt-1 text-xs",
                    accountOk ? "text-success" : "text-warning"
                  )}
                >
                  {accountOk
                    ? `Matches the family ${account.bank} account.`
                    : `Does not match the family ${account.bank} account.`}
                </p>
              </div>

              <p className="text-xs text-muted-foreground">
                When all three details match, this payment is confirmed automatically — no admin
                review needed.
              </p>
            </div>

            <div className="space-y-2 rounded-2xl border p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bank</span>
                <span className="font-semibold">{account.bank}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Account name</span>
                <span className="font-semibold">{account.accountName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Account number</span>
                <span className="flex items-center gap-1 font-mono font-bold tracking-wider">
                  {account.accountNumber}
                  <CopyButton value={account.accountNumber} />
                </span>
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed p-4 transition-colors hover:border-primary">
              <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10">
                {file ? <Check className="size-5 text-primary" /> : <ImagePlus className="size-5 text-primary" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{file ? file.name : "Attach payment receipt"}</p>
                <p className="text-xs text-muted-foreground">
                  {file ? `${Math.round(file.size / 1024)} KB` : "Screenshot or PDF, max 5MB"}
                </p>
              </div>
              <input
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>

            <label className={cn(
              "flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition-colors",
              confirmed ? "border-primary bg-primary/5" : "hover:border-primary/40"
            )}>
              <span className={cn(
                "flex size-5 items-center justify-center rounded-md border",
                confirmed ? "border-primary bg-primary text-primary-foreground" : "border-input"
              )}>
                {confirmed ? <Check className="size-3.5" strokeWidth={3} /> : null}
              </span>
              <span className="text-sm font-medium">I’ve transferred this amount</span>
              <input
                type="checkbox"
                className="hidden"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
            </label>

            <Button
              className="w-full"
              disabled={!confirmed || !file || !enteredAmount || uploading}
              onClick={handleSubmit}
            >
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              {uploading
                ? "Uploading…"
                : allVerified
                  ? "Submit & confirm week"
                  : "Submit for review"}
            </Button>
            {!allVerified ? (
              <p className="text-center text-xs text-warning">
                Some details don’t match yet — this will need a quick admin review.
              </p>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
