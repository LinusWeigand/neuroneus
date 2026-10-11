export type FontRole = "display" | "body";

const VARIABLES: Record<FontRole, string> = { display: "--font-display", body: "--font-body" };
const resolved: Partial<Record<FontRole, string>> = {};

export function font(role: FontRole): string {
  if (!resolved[role]) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(VARIABLES[role]).trim();
    resolved[role] = value || "system-ui, sans-serif";
  }
  return resolved[role]!;
}

export async function loadFonts() {
  await Promise.all(
    (Object.keys(VARIABLES) as FontRole[]).flatMap((role) =>
      ["400", "700"].map((weight) => document.fonts.load(`${weight} 32px ${font(role)}`).catch(() => [])),
    ),
  );
}
