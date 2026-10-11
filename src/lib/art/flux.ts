import "server-only";

export type FluxRequest = { prompt: string; width: number; height: number; references?: Buffer[] };

const MAX_REFERENCES = 4;

export function fluxConfigured() {
  return Boolean(process.env.AZURE_RESOURCE_NAME && process.env.AZURE_API_KEY);
}

function endpoint() {
  const deployment = (process.env.AZURE_IMAGE_DEPLOYMENT || "FLUX.2-pro").toLowerCase().replace(/\./g, "-");
  return `https://${process.env.AZURE_RESOURCE_NAME}.services.ai.azure.com/providers/blackforestlabs/v1/${deployment}?api-version=preview`;
}

export async function generateImage(request: FluxRequest, attempts = 3): Promise<Buffer> {
  const body: Record<string, unknown> = {
    model: process.env.AZURE_IMAGE_DEPLOYMENT || "FLUX.2-pro",
    prompt: request.prompt,
    width: request.width,
    height: request.height,
    output_format: "png",
  };
  (request.references ?? []).slice(0, MAX_REFERENCES).forEach((image, i) => {
    body[i === 0 ? "input_image" : `input_image_${i + 1}`] = image.toString("base64");
  });
  let lastError = "";
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const res = await fetch(endpoint(), {
      method: "POST",
      headers: { "api-key": process.env.AZURE_API_KEY!, "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });
    const json = (await res.json().catch(() => ({}))) as { data?: { b64_json?: string }[]; stop_reason?: string; error?: { message?: string } };
    const b64 = json.data?.[0]?.b64_json;
    if (res.ok && b64) return Buffer.from(b64, "base64");
    lastError = json.error?.message ?? json.stop_reason ?? `HTTP ${res.status}`;
    if (res.status === 429) await new Promise((r) => setTimeout(r, 4000 * attempt));
  }
  throw new Error(`Image generation failed: ${lastError}`);
}
