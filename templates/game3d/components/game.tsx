"use client";

import { useEffect, useRef } from "react";
import { Hud } from "./hud";

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

  return (
    <main className="fixed inset-0 touch-none select-none">
      <div ref={host} data-game className="absolute inset-0" />
      <Hud />
    </main>
  );
}
