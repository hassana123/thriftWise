"use client";

import * as React from "react";
import confetti from "canvas-confetti";

export function useConfetti() {
  return React.useCallback(() => {
    const defaults = { colors: ["#16A34A", "#22C55E", "#4ADE80", "#86EFAC", "#FBBF24", "#60A5FA"] };
    confetti({ ...defaults, particleCount: 90, spread: 75, origin: { y: 0.7 }, startVelocity: 42 });
    confetti({
      ...defaults,
      particleCount: 45,
      angle: 60,
      spread: 60,
      origin: { x: 0, y: 0.75 },
    });
    confetti({
      ...defaults,
      particleCount: 45,
      angle: 120,
      spread: 60,
      origin: { x: 1, y: 0.75 },
    });
  }, []);
}

export function ConfettiBurst({ active }: { active: boolean }) {
  const fire = useConfetti();
  React.useEffect(() => {
    if (active) fire();
  }, [active, fire]);
  return null;
}
