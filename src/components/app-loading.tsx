"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";

import { Logo } from "@/components/logo";
import { useThrift } from "@/providers/thrift-provider";
import { useAuth } from "@/providers/auth-provider";

export function AppLoading({ children }: { children: React.ReactNode }) {
  const { isReady } = useThrift();
  const { loading } = useAuth();
  const ready = isReady && !loading;

  return (
    <>
      <AnimatePresence mode="wait">
        {!ready ? (
          <motion.div
            key="splash"
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-background"
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 18 }}
            >
              <Logo />
            </motion.div>
            <div className="flex items-center gap-1.5">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="size-1.5 rounded-full bg-primary"
                  animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
                />
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <div className={ready ? "contents" : "invisible"}>{children}</div>
    </>
  );
}
