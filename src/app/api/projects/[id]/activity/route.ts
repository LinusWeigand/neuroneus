import { NextResponse } from "next/server";
import { buildEvents, selfOrigin, watchBuild } from "@/lib/build/engine";
import { getProject, lastMessageSeq, toProjectDTO } from "@/lib/data";
import { getT } from "@/lib/i18n/server";

export async function GET(request: Request, ctx: RouteContext<"/api/projects/[id]/activity">) {
  const { id } = await ctx.params;
  const project = await getProject(id);
  if (!project) return NextResponse.json({ error: (await getT()).t.errors.notFound }, { status: 404 });

  const url = new URL(request.url);
  const after = Number(url.searchParams.get("after")) || 0;
  const build = await watchBuild(id, selfOrigin(request));
  const sameRound = url.searchParams.get("build") === build?.id;
  const [events, lastSeq] = await Promise.all([
    build ? buildEvents(build.id, sameRound ? after : 0) : [],
    lastMessageSeq(id),
  ]);
  return NextResponse.json({ project: toProjectDTO(project), build, events, lastSeq });
}
