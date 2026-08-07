"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  Users,
  BarChart3,
  Settings,
  Bell,
  LogOut,
  Moon,
  Sun,
  ChevronRight,
  Wallet,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageTransition } from "@/components/page-transition";
import { useTheme } from "@/components/theme-provider";
import { useAuth } from "@/providers/auth-provider";
import { useThrift } from "@/providers/thrift-provider";
import { initials, formatMoneyCompact } from "@/lib/format";
import { getFamilySavings } from "@/domain/calculations";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/ledger", label: "Ledger", icon: BookOpen },
  { href: "/members", label: "Family", icon: Users },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const { state, isReady, isReloading, markNotificationsRead } = useThrift();
  const { resolvedTheme, toggle } = useTheme();

  const totalSaved = React.useMemo(() => (state ? getFamilySavings(state) : 0), [state]);

  const needsOnboarding = isReady && !isReloading && !loading && user && !state;
  const isOnboarding = pathname === "/onboarding";

  React.useEffect(() => {
    if (loading || !isReady) return;
    if (!user && !isOnboarding) {
      router.replace("/login");
      return;
    }
    if (needsOnboarding && !isOnboarding) {
      router.replace("/onboarding");
    }
  }, [user, loading, isReady, needsOnboarding, router, isOnboarding]);

  const unreadCount = React.useMemo(() => {
    if (!state || !user) return 0;
    return state.notifications.filter((n) => !n.read && (n.userId === "me" || n.userId === user.uid)).length;
  }, [state, user]);

  const markAllRead = React.useCallback(() => markNotificationsRead(), [markNotificationsRead]);

  if (loading || !isReady) return null;

  if (!user) {
    if (isOnboarding) {
      return (
        <div className="flex min-h-screen bg-background">
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
            {children}
          </main>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-card/60 px-4 py-6 backdrop-blur lg:flex">
        <Link href="/dashboard" className="px-2">
          <Logo />
        </Link>

        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link key={item.href} href={item.href}>
                <span
                  className={cn(
                    "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <item.icon className="size-[18px]" />
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="space-y-2">
          <Link href="/settings">
            <span
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                pathname === "/settings"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Settings className="size-[18px]" />
              Settings
            </span>
          </Link>
          <Separator />
          <UserCard />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b bg-background/80 px-4 backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="lg:hidden">
              <Logo showText={false} />
            </Link>
            <PageTitle pathname={pathname} />
          </div>

          <div className="flex items-center gap-1.5">
            <Link
              href="/analytics"
              title={`Total family savings: ${formatMoneyCompact(totalSaved)}`}
              className="flex items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-1.5 transition-colors hover:border-primary/40 hover:bg-primary/5"
            >
              <Wallet className="size-3.5 text-primary" />
              <span className="text-xs font-bold tabular-nums">{formatMoneyCompact(totalSaved)}</span>
              <span className="hidden text-[10px] font-medium text-muted-foreground sm:inline">
                saved
              </span>
            </Link>

            <Button variant="ghost" size="icon" onClick={toggle} className="rounded-full" aria-label="Toggle theme">
              {resolvedTheme === "dark" ? (
                <Sun className="size-[18px]" />
              ) : (
                <Moon className="size-[18px]" />
              )}
            </Button>

            <DropdownMenu onOpenChange={(open) => open && markAllRead()}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative rounded-full" aria-label="Notifications">
                  <Bell className="size-[18px]" />
                  {unreadCount > 0 ? (
                    <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  ) : null}
                </Button>
              </DropdownMenuTrigger>
              <NotificationPanel />
            </DropdownMenu>

            <UserMenu />
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-6 sm:px-6 lg:pb-10">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>

      <BottomNav pathname={pathname} />
    </div>
  );
}

function UserCard() {
  const { member, signOut } = useAuth();
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-secondary/60 p-3">
      <Avatar className="size-10">
        <AvatarFallback style={{ backgroundColor: member?.color }} className="text-white">
          {initials(member?.name ?? "U")}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{member?.name ?? "User"}</p>
        <p className="truncate text-xs capitalize text-muted-foreground">{member?.role ?? "member"}</p>
      </div>
      <Button variant="ghost" size="icon-sm" onClick={() => signOut()} aria-label="Sign out">
        <LogOut className="size-4" />
      </Button>
    </div>
  );
}

function UserMenu() {
  const { member, user, signOut } = useAuth();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="ml-1 rounded-full ring-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Profile menu">
          <Avatar className="size-9">
            <AvatarFallback style={{ backgroundColor: member?.color }} className="text-white text-xs">
              {initials(member?.name ?? "U")}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <p className="font-semibold">{member?.name ?? "User"}</p>
          <p className="truncate text-xs font-normal text-muted-foreground">{user?.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings className="size-4" /> Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/analytics">
            <BarChart3 className="size-4" /> Analytics
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut()} className="text-destructive">
          <LogOut className="size-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotificationPanel() {
  const { state } = useThrift();
  const { user } = useAuth();
  const notifications = React.useMemo(
    () => (state && user ? state.notifications.filter((n) => n.userId === "me" || n.userId === user.uid).slice(0, 6) : []),
    [state, user]
  );
  return (
    <DropdownMenuContent align="end" className="w-80">
      <DropdownMenuLabel className="flex items-center justify-between">
        Notifications
        {notifications.length > 0 ? (
          <Badge variant="secondary">{notifications.filter((n) => !n.read).length} new</Badge>
        ) : null}
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <div className="max-h-80 overflow-y-auto p-1">
        {notifications.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">You’re all caught up.</p>
        ) : (
          notifications.map((n) => (
            <div key={n.id} className={cn("flex gap-3 rounded-xl px-3 py-2.5", !n.read && "bg-primary/5")}>
              <div className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read ? "bg-muted-foreground/40" : "bg-primary")} />
              <div className="min-w-0">
                <p className="text-sm font-medium leading-tight">{n.title}</p>
                <p className="text-xs text-muted-foreground">{n.body}</p>
              </div>
            </div>
          ))
        )}
      </div>
      <DropdownMenuSeparator />
      <DropdownMenuItem asChild>
        <Link href="/settings" className="justify-center text-primary">
          Manage notifications <ChevronRight className="size-3.5" />
        </Link>
      </DropdownMenuItem>
    </DropdownMenuContent>
  );
}

function PageTitle({ pathname }: { pathname: string }) {
  const title = NAV_ITEMS.find((i) => pathname.startsWith(i.href))?.label ?? "ThriftWise";
  return <h1 className="text-lg font-bold">{title}</h1>;
}

function BottomNav({ pathname }: { pathname: string }) {
  const items = NAV_ITEMS.slice(0, 5);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <Link key={item.href} href={item.href} className="flex flex-col items-center gap-1 py-2.5">
              <motion.span
                whileTap={{ scale: 0.85 }}
                className={cn(
                  "relative flex size-9 items-center justify-center rounded-full transition-colors",
                  active ? "bg-primary/10 text-primary" : "text-muted-foreground"
                )}
              >
                <item.icon className="size-5" strokeWidth={active ? 2.4 : 2} />
                {active ? (
                  <motion.span
                    layoutId="bottom-nav-pill"
                    className="absolute -bottom-0.5 size-1 rounded-full bg-primary"
                  />
                ) : null}
              </motion.span>
              <span className={cn("text-[10px] font-medium", active ? "text-primary" : "text-muted-foreground")}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
