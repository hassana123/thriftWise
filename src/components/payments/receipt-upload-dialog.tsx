"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { CalendarDays, Check, ImagePlus, Loader2, PartyPopper, ShieldCheck } from "lucide-react";

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
import { useConfetti } from "@/components/confetti";
import { uploadReceipt } from "@/lib/upload";
import { CopyButton } from "@/components/copy-button";

export function ReceiptUploadDialog({
  open,
  onOpenChange,
  weekId,
  weekNumber,
  amount,
  account,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  weekId: string;
  weekNumber: number;
  amount: number;
  account: { bank: string; accountName: string; accountNumber: string };
}) {
  const { uploadReceipt: saveReceipt } = useThrift();
  const { member } = useAuth();
  const fireConfetti = useConfetti();

  const [confirmed, setConfirmed] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [receiptAmount, setReceiptAmount] = React.useState<string>("");
  const [senderName, setSenderName] = React.useState("");
  const [accountNumber, setAccountNumber] = React.useState("");
  const [daysPaid, setDaysPaid] = React.useState(5);
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
      setDaysPaid(5);
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

  const daysLabel = React.useMemo(() => {
    if (daysPaid <= 5) return "This week only (Mon–Fri)";
    const weeks = Math.floor(daysPaid / 5);
    const extra = daysPaid % 5;
    if (extra === 0) return `${weeks} full weeks (${daysPaid} working days)`;
    return `${weeks} week${weeks > 1 ? "s" : ""} + ${extra} day${extra > 1 ? "s" : ""} of the next week`;
  }, [daysPaid]);

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

  async function handleSubmit() {
    if (!member || !file) return;
    setUploading(true);
    try {
      const url = await uploadReceipt(file, member.id, weekId);
      saveReceipt(member.id, weekId, url, enteredAmount || undefined, allVerified, daysPaid);
      setWasAutoApproved(allVerified);
      setDone(true);
      fireConfetti();
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[75vh] max-w-sm flex-col gap-5 sm:max-h-[85vh]">
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
                {wasAutoApproved ? "Payment confirmed!" : "Receipt submitted!"}
              </p>
              <p className="text-sm text-muted-foreground">
                {wasAutoApproved ? (
                  <>
                    All details matched — your payment is now{" "}
                    <span className="font-semibold text-foreground">marked as paid</span> for{" "}
                    <span className="font-semibold text-foreground">{daysLabel}</span>. No review
                    needed.
                  </>
                ) : (
                  <>
                    Your payment for{" "}
                    <span className="font-semibold text-foreground">{daysLabel}</span> is now{" "}
                    <span className="font-semibold text-foreground">pending review</span>. The admin
                    will approve it shortly.
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
            <div className="rounded-2xl bg-primary p-4 text-primary-foreground">
              <p className="text-xs text-primary-foreground/70">
                Amount on your receipt (editable)
              </p>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-bold text-primary-foreground/70">
                  ₦
                </span>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  className="h-12 border-white/20 bg-white/10 pl-9 text-2xl font-bold text-white placeholder:text-primary-foreground/50 focus-visible:bg-white/15"
                  value={receiptAmount}
                  onChange={(e) => setReceiptAmount(e.target.value)}
                  placeholder={formatMoney(amount)}
                />
              </div>
              <p className="mt-1.5 text-xs text-primary-foreground/70">
                Enter exactly what the receipt shows — that amount will be recorded.
              </p>
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

            <div className="space-y-2 rounded-2xl border p-4">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <CalendarDays className="size-4 text-primary" /> How many days does this cover?
              </p>
              <p className="text-xs text-muted-foreground">
                Paying for extra days covers the next week(s). Weekends are never counted — only
                working days.
              </p>
              <div className="grid grid-cols-4 gap-1.5">
                {[5, 7, 10, 15].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDaysPaid(d)}
                    className={cn(
                      "rounded-xl border-2 py-2 text-sm font-bold transition-all",
                      daysPaid === d
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40"
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Custom days:</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={daysPaid}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setDaysPaid(Number.isFinite(v) && v > 0 ? v : 5);
                  }}
                  className="h-9 w-20 text-center font-bold"
                />
              </div>
              <p className="rounded-xl bg-secondary/60 px-3 py-2 text-xs font-medium">
                {daysLabel}
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
