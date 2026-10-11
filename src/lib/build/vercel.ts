import "server-only";

const API = "https://api.vercel.com";

function token() {
  return process.env.VERCEL_API_KEY || process.env.VERCEL_TOKEN;
}

export function vercelConfigured() {
  return Boolean(token());
}

let teamIdCache: string | null | undefined;

async function teamId(): Promise<string | null> {
  if (process.env.VERCEL_TEAM_ID) return process.env.VERCEL_TEAM_ID;
  if (teamIdCache !== undefined) return teamIdCache;
  const { user } = await call<{ user: { defaultTeamId?: string | null } }>("/v2/user", {}, false);
  teamIdCache = user.defaultTeamId ?? null;
  return teamIdCache;
}

type VercelError = Error & { status?: number; code?: string; missing?: string[] };

async function call<T>(path: string, init: RequestInit = {}, scoped = true): Promise<T> {
  const url = new URL(API + path);
  if (scoped) {
    const team = await teamId();
    if (team) url.searchParams.set("teamId", team);
  }
  const res = await fetch(url, {
    ...init,
    headers: { authorization: `Bearer ${token()}`, "content-type": "application/json", ...init.headers },
    signal: AbortSignal.timeout(60_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`Vercel ${res.status}: ${body.error?.message ?? res.statusText}`) as VercelError;
    err.status = res.status;
    err.code = body.error?.code;
    err.missing = body.error?.missing;
    throw err;
  }
  return body as T;
}

export type VercelProject = { id: string; name: string };

export async function createProject(baseName: string): Promise<VercelProject> {
  const base = baseName.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "app";
  for (let i = 1; i <= 20; i++) {
    const name = i === 1 ? base : `${base}-${i}`;
    try {
      const project = await call<VercelProject>("/v11/projects", {
        method: "POST",
        body: JSON.stringify({ name, framework: "nextjs", serverlessFunctionRegion: "fra1" }),
      });
      await call(`/v9/projects/${project.id}`, { method: "PATCH", body: JSON.stringify({ ssoProtection: null }) }).catch(
        (err) => console.warn("[vercel] could not relax deployment protection", err),
      );
      return { id: project.id, name: project.name };
    } catch (err) {
      const e = err as { status?: number; code?: string };
      if (e.status === 409 || e.code === "conflict") continue;
      throw err;
    }
  }
  throw new Error("Could not find a free Vercel project name.");
}

export async function projectExists(projectId: string) {
  try {
    await call(`/v9/projects/${projectId}`);
    return true;
  } catch (err) {
    if ((err as { status?: number }).status === 404) return false;
    throw err;
  }
}

export async function deleteProject(projectId: string) {
  try {
    await call(`/v9/projects/${projectId}`, { method: "DELETE" });
  } catch (err) {
    if ((err as { status?: number }).status !== 404) throw err;
  }
}

export async function setEnv(projectId: string, key: string, value: string) {
  await call(`/v10/projects/${projectId}/env?upsert=true`, {
    method: "POST",
    body: JSON.stringify({ key, value, type: "encrypted", target: ["production", "preview", "development"] }),
  });
}

export type Deployment = {
  id: string;
  url: string;
  readyState: "QUEUED" | "INITIALIZING" | "BUILDING" | "READY" | "ERROR" | "CANCELED";
  alias?: string[];
  errorMessage?: string;
};

export type AssetRef = { sha1: string; size: number; url: string };
export type AssetLock = Record<string, AssetRef>;

export function assetLock(files: Record<string, string>): AssetLock {
  try {
    return JSON.parse(files["assets.lock.json"] ?? "{}") as AssetLock;
  } catch {
    return {};
  }
}

async function uploadFile(asset: AssetRef) {
  const res = await fetch(asset.url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`Asset ${asset.url} is unavailable (${res.status}).`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  await call("/v2/files", {
    method: "POST",
    headers: { "content-type": "application/octet-stream", "x-vercel-digest": asset.sha1, "content-length": String(bytes.length) },
    body: bytes,
  });
}

export async function deploy(project: VercelProject, files: Record<string, string>, options: { production?: boolean } = {}) {
  const assets = assetLock(files);
  const body = JSON.stringify({
    name: project.name,
    project: project.id,
    ...(options.production === false ? {} : { target: "production" }),
    files: [
      ...Object.entries(files).map(([file, data]) => ({ file, data, encoding: "utf-8" })),
      ...Object.entries(assets).map(([file, asset]) => ({ file, sha: asset.sha1, size: asset.size })),
    ],
    projectSettings: { framework: "nextjs" },
  });
  const create = () => call<Deployment>("/v13/deployments?skipAutoDetectionConfirmation=1", { method: "POST", body });
  try {
    return await create();
  } catch (err) {
    const missing = (err as VercelError).code === "missing_files" ? ((err as VercelError).missing ?? []) : null;
    if (!missing) throw err;
    const bySha = new Map(Object.values(assets).map((a) => [a.sha1, a]));
    for (let i = 0; i < missing.length; i += 6) {
      await Promise.all(missing.slice(i, i + 6).map((sha) => bySha.get(sha)).filter((a): a is AssetRef => Boolean(a)).map(uploadFile));
    }
    return create();
  }
}

export async function promote(projectId: string, deploymentId: string) {
  const { domains } = await call<{ domains: { name: string; verified: boolean }[] }>(`/v9/projects/${projectId}/domains`);
  for (const domain of domains.filter((d) => d.verified)) {
    await call(`/v2/deployments/${deploymentId}/aliases`, { method: "POST", body: JSON.stringify({ alias: domain.name }) });
  }
  return domains.map((d) => d.name);
}

export async function getDeployment(id: string) {
  return call<Deployment>(`/v13/deployments/${id}`);
}

export async function productionUrl(projectId: string): Promise<string | null> {
  const { domains } = await call<{ domains: { name: string; verified: boolean }[] }>(`/v9/projects/${projectId}/domains`);
  const domain = domains.find((d) => d.verified) ?? domains[0];
  return domain ? `https://${domain.name}` : null;
}

export async function latestLogLines(id: string): Promise<string[]> {
  const events = await call<{ text?: string; payload?: { text?: string } }[]>(
    `/v3/deployments/${id}/events?builds=1&direction=backward&limit=20`,
  );
  return (Array.isArray(events) ? events : []).map((e) => e.text ?? e.payload?.text ?? "").filter(Boolean);
}

export async function buildErrors(id: string): Promise<string> {
  const events = await call<{ type: string; text?: string; payload?: { text?: string } }[]>(
    `/v3/deployments/${id}/events?builds=1&direction=forward&limit=-1`,
  ).catch(() => []);
  const lines = (Array.isArray(events) ? events : [])
    .map((e) => e.text ?? e.payload?.text ?? "")
    .filter(Boolean);
  const firstError = lines.findIndex((l) => /error|failed|cannot find|is not assignable|unexpected/i.test(l));
  const slice = firstError >= 0 ? lines.slice(Math.max(0, firstError - 5), firstError + 60) : lines.slice(-60);
  return slice.join("\n").slice(0, 8000);
}
