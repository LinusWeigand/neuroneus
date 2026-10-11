import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { cancelBuild, selfOrigin, watchBuild } from "@/lib/build/engine";
import { teardownProject } from "@/lib/build/infra";
import { getChanges, getDecisions, getMessages, getProject, requestCancel, toProjectDTO } from "@/lib/data";
import { db, schema } from "@/lib/db";
import { availableModels } from "@/lib/models";
import { getT } from "@/lib/i18n/server";

const SYNC_OVERLAP_MS = 10_000;

export async function GET(request: Request, ctx: RouteContext<"/api/projects/[id]">) {
  const { id } = await ctx.params;
  const project = await getProject(id);
  if (!project) return NextResponse.json({ error: (await getT()).t.errors.notFound }, { status: 404 });

  const syncedAt = Date.now();
  const params = new URL(request.url).searchParams;
  const after = Number(params.get("after"));
  const since = Number(params.get("since"));
  const incremental = Number.isFinite(after) && after > 0 && Number.isFinite(since) && since > 0;

  const [changes, build] = await Promise.all([
    incremental
      ? getChanges(id, after, new Date(since - SYNC_OVERLAP_MS))
      : Promise.all([getMessages(id), getDecisions(id)]).then(([messages, decisions]) => ({ messages, decisions })),
    watchBuild(id, selfOrigin(request)),
  ]);
  return NextResponse.json({ project: toProjectDTO(project), ...changes, build, incremental, syncedAt });
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/projects/[id]">) {
  const { id } = await ctx.params;
  const { t } = await getT();
  const project = await getProject(id);
  if (!project) return NextResponse.json({ error: t.errors.notFound }, { status: 404 });

  const offered = new Set(availableModels().map((m) => m.id));
  const parsed = z
    .object({ builderModel: z.string().refine((model) => model === "auto" || offered.has(model)) })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: t.errors.invalidInput }, { status: 400 });

  const builderModel = parsed.data.builderModel === "auto" ? null : parsed.data.builderModel;
  const [saved] = await db.update(schema.projects).set({ builderModel }).where(eq(schema.projects.id, id)).returning();
  return NextResponse.json({ project: toProjectDTO(saved) });
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/projects/[id]">) {
  const { id } = await ctx.params;
  const { t } = await getT();
  const project = await getProject(id);
  if (!project) return NextResponse.json({ error: t.errors.notFound }, { status: 404 });

  await requestCancel(id);
  await cancelBuild(id);

  const failures = await teardownProject(project);
  if (failures.length > 0) {
    console.error("[project] delete failed", failures);
    const parts = failures.map((f) => t.errors.deleteParts[f.part]).join(", ");
    return NextResponse.json({ error: t.errors.deleteFailed(parts) }, { status: 502 });
  }
  await db.delete(schema.projects).where(eq(schema.projects.id, id));
  return NextResponse.json({ deleted: true });
}
