import Link from "next/link";
import { BRAND } from "@/lib/brand";

export function Wordmark({ href = "/", className = "", label }: { href?: string; className?: string; label: string }) {
  return (
    <Link href={href} className={`inline-flex items-baseline gap-0.5 text-ink ${className}`} aria-label={label}>
      <span className="text-display-sm tracking-[-0.4px]">{BRAND}</span>
    </Link>
  );
}
