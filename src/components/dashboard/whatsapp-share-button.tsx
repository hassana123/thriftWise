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
import { useThrift } from "@/providers/thrift-provider";
import { renderLedgerImage } from "@/lib/ledger-image";

export function WhatsAppShareButton({
  variant = "outline",
  className,
}: {
  variant?: "outline" | "secondary" | "default";
  className?: string;
}) {
  const { state } = useThrift();
  const [capturing, setCapturing] = React.useState(false);
  const [image, setImage] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  if (!state) return null;

  const currentState = state;

  async function handleShare() {
    if (capturing) return;
    setCapturing(true);
    try {
      const dataUrl = await renderLedgerImage(currentState);
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
      // iOS Safari ignores the anchor `download` attribute, so it only saves via
      // the native share sheet. Ask for "Save Image" there when files are supported.
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: "Family thrift ledger" });
          return;
        } catch {
          /* user cancelled the sheet — fall through to the anchor fallback */
        }
      }
    } catch {
      /* blob fetch failed — fall through to the anchor fallback */
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
      /* share cancelled or unsupported — fall through to download */
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
          onClick={handleShare}
          disabled={capturing}
        >
          {capturing ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
          {capturing ? "Creating picture…" : "Share ledger picture"}
        </Button>
      </div>

      <Dialog open={image !== null} onOpenChange={(o) => !o && setImage(null)}>
        <DialogContent className="flex max-h-[85vh] max-w-md flex-col gap-4">
          <DialogHeader className="shrink-0 text-left">
            <DialogTitle>Ledger picture</DialogTitle>
            <DialogDescription>
              Download the image, or share it directly into the WhatsApp group.
            </DialogDescription>
          </DialogHeader>

          {image ? (
            <div className="min-h-0 overflow-y-auto rounded-xl border bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt="Family thrift ledger" className="w-full" />
            </div>
          ) : null}

          <div className="shrink-0">
            <div className="flex flex-col gap-2">
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
            </div>
          </div>

          <p className="shrink-0 text-center text-xs text-muted-foreground">
            Tip: if “Share to WhatsApp” isn’t available on this device, download the image and
            attach it in the group chat.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
