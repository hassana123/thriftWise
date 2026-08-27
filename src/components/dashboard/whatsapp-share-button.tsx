"use client";

import * as React from "react";
import { Camera, Check, Download, Loader2, MessageCircle, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useThrift } from "@/providers/thrift-provider";
import { renderLedgerImage, type LedgerImageWeekRange } from "@/lib/ledger-image";
import { formatDate } from "@/lib/format";

export function WhatsAppShareButton({
  variant = "outline",
  className,
}: {
  variant?: "outline" | "secondary" | "default";
  className?: string;
}) {
  const { state } = useThrift();
  const [open, setOpen] = React.useState(false);
  const [capturing, setCapturing] = React.useState(false);
  const [image, setImage] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [startWeek, setStartWeek] = React.useState<string>("all");
  const [endWeek, setEndWeek] = React.useState<string>("all");

  if (!state) return null;

  const currentState = state;
  const weeks = currentState.weeks;

  // Default range: all weeks
  const startIndex = startWeek === "all" ? 0 : parseInt(startWeek, 10);
  const endIndex = endWeek === "all" ? weeks.length - 1 : parseInt(endWeek, 10);
  const isPartialRange = startWeek !== "all" || endWeek !== "all";

  function handleOpen() {
    setImage(null);
    setCopied(false);
    setStartWeek("all");
    setEndWeek("all");
    setOpen(true);
  }

  async function handleGenerate() {
    if (capturing) return;
    setCapturing(true);
    try {
      const range: LedgerImageWeekRange | undefined = isPartialRange
        ? { startIndex, endIndex: Math.max(startIndex, endIndex) }
        : undefined;
      const dataUrl = await renderLedgerImage(currentState, range);
      setImage(dataUrl);
    } catch (error) {
      console.error("Failed to render ledger image", error);
    } finally {
      setCapturing(false);
    }
  }

  async function handleDownload() {
    if (!image) return;
    try {
      const blob = await (await fetch(image)).blob();
      const file = new File([blob], "thrift-ledger.png", { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: "Family thrift ledger" });
          return;
        } catch {
          /* user cancelled the sheet */
        }
      }
    } catch {
      /* blob fetch failed */
    }
    const a = document.createElement("a");
    a.href = image;
    a.download = "thrift-ledger.png";
    a.click();
  }

  async function handleNativeShare() {
    if (!image) return;
    try {
      const blob = await (await fetch(image)).blob();
      const file = new File([blob], "thrift-ledger.png", { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Family thrift ledger" });
        return;
      }
    } catch {
      /* share cancelled or unsupported */
    }
    await handleDownload();
  }

  async function handleCopy() {
    if (!image) return;
    try {
      const blob = await (await fetch(image)).blob();
      const file = new File([blob], "thrift-ledger.png", { type: "image/png" });
      if (navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": file })]);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      } else {
        await handleDownload();
      }
    } catch {
      await handleDownload();
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={variant}
          size="sm"
          className={className}
          onClick={handleOpen}
        >
          <Camera className="size-4" />
          Share ledger picture
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[85vh] max-w-md flex-col gap-4">
          <DialogHeader className="shrink-0 text-left">
            <DialogTitle>Ledger picture</DialogTitle>
            <DialogDescription>
              Choose which weeks to include, then generate the image.
            </DialogDescription>
          </DialogHeader>

          {!image ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Start week</Label>
                  <Select value={startWeek} onValueChange={(v) => {
                    setStartWeek(v);
                    // Auto-adjust end week if start exceeds it
                    if (v !== "all") {
                      const s = parseInt(v, 10);
                      if (endWeek !== "all" && parseInt(endWeek, 10) < s) {
                        setEndWeek(v);
                      }
                    }
                  }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All weeks</SelectItem>
                      {weeks.map((w) => (
                        <SelectItem key={w.id} value={String(w.number - 1)}>
                          Week {w.number} \u00B7 {formatDate(w.startDate, "MMM d")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>End week</Label>
                  <Select value={endWeek} onValueChange={(v) => {
                    setEndWeek(v);
                    // Auto-adjust start week if end is before it
                    if (v !== "all") {
                      const e = parseInt(v, 10);
                      if (startWeek !== "all" && parseInt(startWeek, 10) > e) {
                        setStartWeek(v);
                      }
                    }
                  }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All weeks</SelectItem>
                      {weeks.map((w) => (
                        <SelectItem key={w.id} value={String(w.number - 1)}>
                          Week {w.number} \u00B7 {formatDate(w.startDate, "MMM d")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {isPartialRange && (
                <p className="text-xs text-muted-foreground">
                  Showing Week {weeks[startIndex]?.number} to Week {weeks[Math.max(startIndex, endIndex)]?.number} \u00B7 {Math.max(startIndex, endIndex) - startIndex + 1} week{Math.max(startIndex, endIndex) - startIndex === 0 ? "" : "s"} selected
                </p>
              )}

              <Button className="w-full gap-2" onClick={handleGenerate} disabled={capturing}>
                {capturing ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
                {capturing ? "Creating picture\u2026" : "Generate picture"}
              </Button>
            </div>
          ) : (
            <>
              <div className="min-h-0 overflow-y-auto rounded-xl border bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt="Family thrift ledger" className="w-full" />
              </div>

              <div className="shrink-0 space-y-2">
                <Button className="w-full gap-2" onClick={handleNativeShare}>
                  <MessageCircle className="size-4" /> Share to WhatsApp
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" className="gap-2" onClick={handleDownload}>
                    <Download className="size-4" /> Download
                  </Button>
                  <Button variant="outline" className="gap-2" onClick={handleCopy}>
                    {copied ? <Check className="size-4 text-success" /> : <Share2 className="size-4" />}
                    {copied ? "Copied" : "Copy image"}
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full gap-2 text-xs"
                  onClick={() => { setImage(null); setCopied(false); }}
                >
                  \u2190 Change week range
                </Button>
              </div>
            </>
          )}

          <p className="shrink-0 text-center text-xs text-muted-foreground">
            Tip: if \u201CShare to WhatsApp\u201D isn\u2019t available on this device, download the image and
            attach it in the group chat.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
