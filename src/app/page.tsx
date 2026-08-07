"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { PiggyBank, ShieldCheck } from "lucide-react";

import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/providers/auth-provider";
import { useThrift } from "@/providers/thrift-provider";

export default function LandingPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const { state, isReady, isReloading } = useThrift();

  // Only redirect once auth + thrift have settled. Redirecting early (while the
  // thrift is still loading or being refreshed) can send a signed-in user to
  // /onboarding instead of /dashboard based purely on timing.
  const settled = isReady && !isReloading && !loading;

  React.useEffect(() => {
    if (!settled) return;
    if (user) {
      const target = state ? "/dashboard" : "/onboarding";
      if (pathname !== target) router.replace(target);
      return;
    }
    if (state) {
      if (pathname !== "/login") router.replace("/login");
    }
  }, [user, state, settled, router, pathname]);

  if (!settled || user || state) return null;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-emerald-50 via-background to-background px-4 dark:from-emerald-950/40">
      <div className="pointer-events-none absolute -top-32 left-1/2 size-96 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 size-64 rounded-full bg-amber-200/15 blur-3xl dark:bg-amber-500/10" />

      <div className="relative w-full max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Save together. <span className="text-gradient">Vacation together.</span>
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm text-muted-foreground sm:text-base">
          ThriftWise tracks your family&apos;s daily savings and weekly contributions in one simple
          place.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <Button asChild size="lg" className="w-full gap-2">
            <Link href="/login">
              <PiggyBank className="size-4" /> Enter with your name
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="w-full gap-2">
            <Link href="/login/admin">
              <ShieldCheck className="size-4" /> Admin sign in
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
