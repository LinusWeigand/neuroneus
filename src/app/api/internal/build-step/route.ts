import { timingSafeEqual } from "node:crypto";
import { waitUntil } from "@vercel/functions";
import { NextResponse } from "next/server";
import { internalSecret, runStep } from "@/lib/build/engine";

export const maxDuration = 300;

function authorized(header: string | null) {
  if (!header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(internalSecret());
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!authorized(request.headers.get("x-neuroneus-internal"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as { buildId?: string } | null;
  if (!body?.buildId || !/^[0-9a-f-]{36}$/i.test(body.buildId)) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }
  waitUntil(runStep(body.buildId).catch((err) => console.error("[build-step] crashed", err)));
  return NextResponse.json({ ok: true }, { status: 202 });
}
