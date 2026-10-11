import type { ReactNode } from "react";

export function Badge({ children, tone = "default", className = "" }: { children: ReactNode; tone?: "default" | "card" | "dark"; className?: string }) {
  const tones = {
    default: "bg-surface-strong text-ink",
    card: "bg-surface-card text-ink border border-hairline",
    dark: "bg-surface-dark-elevated text-on-dark",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-caption-upper ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}
