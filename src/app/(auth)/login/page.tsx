"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ShieldCheck, Sparkles } from "lucide-react";

import { Logo } from "@/components/logo";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/providers/auth-provider";
import { useThrift } from "@/providers/thrift-provider";
import { initials } from "@/lib/format";

export default function FamilyLoginPage() {
  const router = useRouter();
  const { signInWithName, user, mode } = useAuth();
  const { state } = useThrift();

  const [error, setError] = React.useState<string | null>(null);

  const family = state?.members.filter((m) => m.status !== "suspended") ?? [];

  React.useEffect(() => {
    if (user) {
      router.replace(state ? "/dashboard" : "/onboarding");
    }
  }, [user, state, router]);

  function enter(displayName: string) {
    setError(null);
    try {
      signInWithName(displayName);
      router.replace(state ? "/dashboard" : "/onboarding");
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't find that name.");
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-emerald-50 via-background to-background px-4 py-10 dark:from-emerald-950/40">
      <div className="pointer-events-none absolute -top-32 left-1/2 size-[420px] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 size-64 rounded-full bg-amber-300/15 blur-3xl" />
      <div className="pointer-events-none absolute bottom-16 left-0 size-56 rounded-full bg-sky-300/15 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-md"
      >
        <div className="mb-8 flex flex-col items-center gap-3">
          <Logo />
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Welcome, family! 💚</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Tap your name below to jump straight into your dashboard.
            </p>
          </div>
        </div>

        <div className="rounded-3xl border bg-card/90 p-5 shadow-soft backdrop-blur sm:p-8">
          {mode === "demo" ? (
            <div className="mb-4 flex justify-center">
              <Badge variant="secondary" className="gap-1">
                <Sparkles className="size-3" /> Demo mode
              </Badge>
            </div>
          ) : null}

          {family.length > 0 ? (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {family.map((m, i) => (
                <motion.button
                  key={m.id}
                  type="button"
                  onClick={() => enter(m.name)}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * i, duration: 0.3 }}
                  whileTap={{ scale: 0.96 }}
                  className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 text-center transition-all hover:border-primary hover:bg-primary/5"
                >
                  <Avatar className="size-12">
                    <AvatarFallback style={{ backgroundColor: m.color }} className="text-sm text-white">
                      {initials(m.name)}
                    </AvatarFallback>
                  </Avatar>
                  <p className="w-full truncate text-sm font-semibold">{m.name}</p>
                </motion.button>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No family members yet — ask the admin to add you.
            </p>
          )}

          {error ? (
            <p className="mt-4 rounded-xl bg-destructive/10 px-3 py-2 text-center text-xs font-medium text-destructive">
              {error}
            </p>
          ) : null}

          <div className="mt-6 text-center">
            <Link
              href="/login/admin"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              <ShieldCheck className="size-3.5" /> Are you the admin? Sign in here
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
