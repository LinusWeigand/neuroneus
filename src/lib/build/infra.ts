import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { ProjectRow } from "@/lib/db/schema";
import { designName } from "@/lib/design/catalog";
import { designBrief } from "@/lib/design/brief";
import { chooseDesign } from "@/lib/design/choose";
import { loadDesign } from "@/lib/design/load";
import { deleteProjectRepo, slugify } from "@/lib/github";
import { DICTIONARIES } from "@/lib/i18n/dictionaries";
import { inferDatabase } from "@/lib/spec/extract";
import { specText } from "@/lib/spec/templates";
import type { UsageScope } from "@/lib/usage";
import { connectionUri, createDatabase, databaseExists, deleteDatabase, type NeonDatabase, neonConfigured } from "./neon";
import { commitChanges, type FileMap, readRepo } from "./repo";
import { chooseFramework } from "./framework-choice";
import { type Framework, frameworkFiles, prepareFrameworkFiles, readMarker } from "./frameworks";
import { humanLanguage } from "./language";
import { agentsMd, databaseFiles, gameFiles, withNeonDependency } from "./template";
import { createProject, deleteProject, projectExists, setEnv, vercelConfigured, type VercelProject } from "./vercel";

export const AGENT_AUTHOR = (name: string) => ({ name: `${name} (Neuroneus)`, email: "agents@neuroneus.dev" });

export function infraConfigured() {
  return neonConfigured() && vercelConfigured();
}

export function neonOf(p: ProjectRow): NeonDatabase | null {
  return p.neonProjectId && p.neonDatabase && p.neonRole
    ? { projectId: p.neonProjectId, databaseName: p.neonDatabase, roleName: p.neonRole }
    : null;
}

export function vercelOf(p: ProjectRow): VercelProject | null {
  return p.vercelProjectId && p.vercelProjectName ? { id: p.vercelProjectId, name: p.vercelProjectName } : null;
}

async function save(id: string, values: Partial<typeof schema.projects.$inferInsert>) {
  const [row] = await db
    .update(schema.projects)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(schema.projects.id, id))
    .returning();
  return row;
}

export type SetupStage = "database" | "hosting" | "starter" | "design" | "conventions";

export async function ensureInfra(
  project: ProjectRow,
  onStage: (stage: SetupStage) => Promise<void> = async () => {},
  opts: { database: boolean } = { database: false },
): Promise<ProjectRow> {
  if (!project.repoFullName) throw new Error("The project has no GitHub repository yet.");
  if (!infraConfigured()) throw new Error("Set NEON_API_KEY and VERCEL_API_KEY to build and deploy apps.");
  let p = project;
  const slug = p.repoFullName!.split("/")[1] || slugify(p.name);

  if (neonOf(p) && !(await databaseExists(p.neonProjectId!))) {
    p = await save(p.id, { neonProjectId: null, neonDatabase: null, neonRole: null });
  }
  if (vercelOf(p) && !(await projectExists(p.vercelProjectId!))) {
    p = await save(p.id, { vercelProjectId: null, vercelProjectName: null, appUrl: null });
  }

  let neon = neonOf(p);
  if (!neon && opts.database) {
    await onStage("database");
    neon = await createDatabase(slug);
    p = await save(p.id, { neonProjectId: neon.projectId, neonDatabase: neon.databaseName, neonRole: neon.roleName });
  }

  let vercel = vercelOf(p);
  if (!vercel) {
    await onStage("hosting");
    vercel = await createProject(slug);
    p = await save(p.id, { vercelProjectId: vercel.id, vercelProjectName: vercel.name });
  }
  if (neon) await setEnv(vercel.id, "DATABASE_URL", await connectionUri(neon));

  const files = await readRepo(p.repoFullName!);
  if (!files["package.json"]) {
    await onStage("starter");
    const language = humanLanguage([p.vision]);
    const copy = DICTIONARIES[language === "German" ? "de" : "en"].build.starter;
    const starter = {
      ...files,
      ...frameworkFiles({
        framework: "starter",
        database: false,
        slug,
        vars: { name: p.name, vision: p.vision.replace(/\s+/g, " ").slice(0, 400), lang: language === "German" ? "de" : "en", ...copy },
      }),
    };
    await commitChanges(p.repoFullName!, files, starter, "Add the starter app", AGENT_AUTHOR("Neuroneus"));
  }

  if (p.infraError) p = await save(p.id, { infraError: null });
  return p;
}

export async function prepareApp(
  project: ProjectRow,
  scope: UsageScope,
  language: "German" | "English",
  onStage: (stage: SetupStage) => Promise<void> = async () => {},
): Promise<{ project: ProjectRow; files: FileMap; framework: Framework | null }> {
  const spec = project.spec;
  if (!spec?.kind) throw new Error("The spec isn't complete yet.");
  let p = project;

  let database = spec.needsDatabase;
  if (database === null) {
    database = await inferDatabase(scope, spec);
    p = await save(p.id, { spec: { ...spec, needsDatabase: database } });
  }
  p = await ensureInfra(p, onStage, { database });
  const before = await readRepo(p.repoFullName!);
  const marker = readMarker(before);
  if (marker.kind && !marker.framework) return { project: p, files: await prepareLegacyApp(p, scope, before, onStage), framework: null };

  const framework = chooseFramework(spec, p.name);
  if (framework === "web" && !p.designSlug) {
    await onStage("design");
    p = await save(p.id, { designSlug: await chooseDesign(scope, { name: p.name, vision: p.vision, spec }) });
  }

  await onStage("conventions");
  const slug = p.repoFullName!.split("/")[1] || slugify(p.name);
  const files = prepareFrameworkFiles({
    before,
    framework,
    database: Boolean(neonOf(p)),
    slug,
    vars: { name: p.name, vision: p.vision.replace(/\s+/g, " ").slice(0, 400), lang: language === "German" ? "de" : "en", tagline: "" },
  });
  if (framework === "web") {
    const designChanged = marker.design !== p.designSlug;
    if (!files["DESIGN.md"] || designChanged) files["DESIGN.md"] = await loadDesign(p.designSlug!);
    if (!files["docs/DESIGN-BRIEF.md"] || designChanged) {
      const brief = await designBrief(scope, { name: designName(p.designSlug!), markdown: files["DESIGN.md"] });
      if (brief) files["docs/DESIGN-BRIEF.md"] = brief;
    }
    files[".neuroneus.json"] = JSON.stringify({ ...readMarker(files), kind: spec.kind, design: p.designSlug }, null, 2) + "\n";
  } else {
    files[".neuroneus.json"] = JSON.stringify({ ...readMarker(files), kind: spec.kind }, null, 2) + "\n";
  }
  files["docs/SPEC.md"] = specDoc(p, spec);

  await commitChanges(
    p.repoFullName!,
    before,
    files,
    framework === "web" ? `Prepare the app: ${designName(p.designSlug!)} design, spec and conventions` : "Prepare the game: framework, spec and conventions",
    AGENT_AUTHOR("Neuroneus"),
  );
  return { project: p, files, framework };
}

function specDoc(p: ProjectRow, spec: NonNullable<ProjectRow["spec"]>) {
  const labels = Object.fromEntries(Object.entries(DICTIONARIES.en.spec.items).map(([k, v]) => [k, v.label]));
  return `# Spec: ${p.name}\n\n> ${p.vision.replace(/\s+/g, " ")}\n\n${specText(spec, labels)}\n`;
}

async function prepareLegacyApp(p: ProjectRow, scope: UsageScope, before: FileMap, onStage: (stage: SetupStage) => Promise<void>) {
  const spec = p.spec!;
  if (!p.designSlug) {
    await onStage("design");
    p = await save(p.id, { designSlug: await chooseDesign(scope, { name: p.name, vision: p.vision, spec }) });
  }
  await onStage("conventions");
  const files: FileMap = { ...before };
  const marker = readMarker(before);
  const designChanged = marker.design !== p.designSlug;
  if (!files["DESIGN.md"] || designChanged) files["DESIGN.md"] = await loadDesign(p.designSlug!);
  if (!files["docs/DESIGN-BRIEF.md"] || designChanged) {
    const brief = await designBrief(scope, { name: designName(p.designSlug!), markdown: files["DESIGN.md"] });
    if (brief) files["docs/DESIGN-BRIEF.md"] = brief;
    else delete files["docs/DESIGN-BRIEF.md"];
  }
  if (spec.kind === "web_game") {
    for (const [path, content] of Object.entries(gameFiles())) files[path] ??= content;
  }
  if (neonOf(p)) {
    for (const [path, content] of Object.entries(databaseFiles())) files[path] ??= content;
    if (files["package.json"]) files["package.json"] = withNeonDependency(files["package.json"]);
  }
  files["docs/SPEC.md"] = specDoc(p, spec);
  files["AGENTS.md"] = agentsMd({ kind: spec.kind!, designName: designName(p.designSlug!), database: Boolean(neonOf(p)) });
  files[".neuroneus.json"] = JSON.stringify({ kind: spec.kind, design: p.designSlug, database: Boolean(neonOf(p)) }, null, 2) + "\n";
  await commitChanges(p.repoFullName!, before, files, `Prepare the app: ${designName(p.designSlug!)} design, spec and conventions`, AGENT_AUTHOR("Neuroneus"));
  return files;
}

export type TeardownPart = "hosting" | "database" | "repository";

export async function teardownProject(project: ProjectRow): Promise<{ part: TeardownPart; message: string }[]> {
  const failures: { part: TeardownPart; message: string }[] = [];
  const remove = async (
    part: TeardownPart,
    present: unknown,
    run: () => Promise<void>,
    clear: Partial<typeof schema.projects.$inferInsert>,
  ) => {
    if (!present) return;
    try {
      await run();
      await save(project.id, clear);
    } catch (err) {
      failures.push({ part, message: err instanceof Error ? err.message : String(err) });
    }
  };
  await remove("hosting", project.vercelProjectId, () => deleteProject(project.vercelProjectId!), {
    vercelProjectId: null,
    vercelProjectName: null,
    appUrl: null,
  });
  await remove("database", project.neonProjectId, () => deleteDatabase(project.neonProjectId!), {
    neonProjectId: null,
    neonDatabase: null,
    neonRole: null,
  });
  await remove("repository", project.repoFullName, () => deleteProjectRepo(project.repoFullName!), {
    repoFullName: null,
    repoUrl: null,
  });
  return failures;
}
