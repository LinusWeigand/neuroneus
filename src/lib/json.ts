import type { z } from "zod";

export function firstJsonObject<T>(text: string | undefined, schema: z.ZodType<T>): T | null {
  if (!text) return null;
  let depth = 0;
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === "\\") i++;
      else if (ch === '"') inString = false;
    } else if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) {
      try {
        const parsed = schema.safeParse(JSON.parse(text.slice(text.indexOf("{"), i + 1)));
        return parsed.success ? parsed.data : null;
      } catch {
        return null;
      }
    }
  }
  return null;
}
