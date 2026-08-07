"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Check, ImagePlus, Loader2, PartyPopper } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";
import { useThrift } from "@/providers/thrift-provider";
import { useAuth } from "@/providers/auth-provider";
import { useConfetti } from "@/components/confetti";
import { uploadReceipt } from "@/lib/upload";

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
  const [uploading, setUploading] = React.useState(false);
  const [done, setDone] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setConfirmed(false);
      setFile(null);
      setReceiptAmount(amount > 0 ? String(amount) : "");
      setUploading(false);
      setDone(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const enteredAmount = React.useMemo(() => {
    const num = parseFloat(receiptAmount);
    return Number.isFinite(num) && num > 0 ? num : 0;
  }, [receiptAmount]);

  async function handleSubmit() {
    if (!member || !file) return;
    setUploading(true);
    try {
      const url = await uploadReceipt(file, member.id, weekId);
      saveReceipt(member.id, weekId, url, enteredAmount || undefined);
      setDone(true);
      fireConfetti();
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm gap-5">
        <DialogHeader className="text-left">
          <DialogTitle>Complete your transfer</DialogTitle>
          <DialogDescription>Week {weekNumber} contribution</DialogDescription>
        </DialogHeader>

        {done ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-4 py-6 text-center"
          >
            <div className="flex size-20 items-center justify-center rounded-full bg-success/15">
              <PartyPopper className="size-10 text-primary" />
            </div>
            <div>
              <p className="text-lg font-bold">Receipt submitted!</p>
              <p className="text-sm text-muted-foreground">
                Your payment is now <span className="font-semibold text-foreground">pending review</span>.
                The admin will approve it shortly.
              </p>
            </div>
            <Button className="w-full" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </motion.div>
        ) : (
          <div className="space-y-4">
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
                Enter exactly what the receipt shows — that amount will be recorded once approved.
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
              <div className="flex justify-between">
                <span className="text-muted-foreground">Account number</span>
                <span className="font-mono font-bold tracking-wider">{account.accountNumber}</span>
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
              {uploading ? "Uploading…" : "Submit for review"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
