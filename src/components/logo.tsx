import { PiggyBank } from "lucide-react";

import { cn } from "@/lib/utils";

export function Logo({ className, showText = true }: { className?: string; showText?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="relative flex size-9 items-center justify-center rounded-2xl bg-primary shadow-float">
        <PiggyBank className="size-5 text-primary-foreground" strokeWidth={2.2} />
        <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-background bg-warning" />
      </div>
      {showText ? (
        <span className="text-lg font-bold tracking-tight">
          Thrift<span className="text-primary">Wise</span>
        </span>
      ) : null}
    </div>
  );
}
