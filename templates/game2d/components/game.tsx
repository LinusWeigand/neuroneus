"use client";

import { useEffect, useRef } from "react";

export function Game() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;
    import("@/game/main").then(({ startGame }) => {
      if (!cancelled && host.current) stop = startGame(host.current);
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  return <div ref={host} data-game className="fixed inset-0 touch-none select-none" />;
}
