"use client";

import * as React from "react";
import { Check, Download, Home, Share } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Logo } from "@/components/logo";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const INSTALLED_KEY = "tw-pwa-installed";
// Only prompt once per browser session (per tab), not on every page you visit.
// Cleared when the session ends, so a fresh visit the next day can ask again.
const PROMPTED_SESSION_KEY = "tw-pwa-prompted-session";

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function markPromptedThisSession() {
  try {
    sessionStorage.setItem(PROMPTED_SESSION_KEY, "1");
  } catch {
    /* storage unavailable — prompt again next navigation */
  }
}

function promptedThisSession() {
  try {
    return sessionStorage.getItem(PROMPTED_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function isIOS() {
  const ua = navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [showInstall, setShowInstall] = React.useState(false);
  const [showIos, setShowIos] = React.useState(false);

  React.useEffect(() => {
    let onControllerChange: (() => void) | undefined;
    if ("serviceWorker" in navigator) {
      let hadController = Boolean(navigator.serviceWorker.controller);
      let refreshing = false;
      const forceFresh = () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      };
      // When the service worker is replaced (e.g. the update that purges the
      // old cache), reload the page once so everyone gets the fresh version
      // instantly — no hard refresh or closing the app needed.
      onControllerChange = () => {
        if (navigator.serviceWorker.controller) {
          if (!hadController) {
            hadController = true;
            return;
          }
          forceFresh();
        }
      };
      navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    if (isStandalone()) return;

    const alreadyInstalled = () => localStorage.getItem(INSTALLED_KEY) === "1";

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      if (alreadyInstalled() || promptedThisSession()) return;
      markPromptedThisSession();
      setShowInstall(true);
    };

    const onInstalled = () => {
      localStorage.setItem(INSTALLED_KEY, "1");
      markPromptedThisSession();
      setShowInstall(false);
      setShowIos(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    if (isIOS() && !alreadyInstalled() && !promptedThisSession()) {
      markPromptedThisSession();
      setShowIos(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      if (onControllerChange) {
        navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      }
    };
  }, []);

  const dismissInstall = () => {
    markPromptedThisSession();
    setShowInstall(false);
  };

  const dismissIos = () => {
    markPromptedThisSession();
    setShowIos(false);
  };

  const install = async () => {
    if (!installEvent) return;
    markPromptedThisSession();
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === "accepted") localStorage.setItem(INSTALLED_KEY, "1");
    setInstallEvent(null);
    setShowInstall(false);
  };

  return (
    <>
      <Dialog open={showInstall} onOpenChange={(open) => !open && dismissInstall()}>
        <DialogContent className="max-w-sm">
          <DialogHeader className="text-center">
            <div className="mb-2 flex justify-center">
              <Logo />
            </div>
            <DialogTitle>Install ThriftWise</DialogTitle>
            <DialogDescription>
              Add ThriftWise to your home screen for one-tap access and a faster, app-like
              experience.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Button onClick={install} className="w-full">
              <Download className="size-4" />
              Install app
            </Button>
            <Button variant="ghost" onClick={dismissInstall} className="w-full">
              Not now
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showIos} onOpenChange={(open) => !open && dismissIos()}>
        <DialogContent className="max-w-sm">
          <DialogHeader className="text-center">
            <div className="mb-2 flex justify-center">
              <Logo />
            </div>
            <DialogTitle>Add ThriftWise to your Home Screen</DialogTitle>
            <DialogDescription>
              For the best experience on iPhone and iPad, install the app in three quick steps.
            </DialogDescription>
          </DialogHeader>
          <ol className="space-y-3 text-sm">
            <li className="flex items-start gap-3 rounded-xl bg-muted p-3">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground">
                1
              </span>
              <span className="flex items-center gap-2">
                Tap the <Share className="size-4 text-primary" /> Share button in the Safari
                toolbar.
              </span>
            </li>
            <li className="flex items-start gap-3 rounded-xl bg-muted p-3">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground">
                2
              </span>
              <span className="flex items-center gap-2">
                Scroll down and tap <Home className="size-4 text-primary" /> Add to Home Screen.
              </span>
            </li>
            <li className="flex items-start gap-3 rounded-xl bg-muted p-3">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground">
                3
              </span>
              <span className="flex items-center gap-2">
                Tap <Check className="size-4 text-primary" /> Add in the top-right corner.
              </span>
            </li>
          </ol>
          <Button onClick={dismissIos} className="w-full">
            Got it
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
