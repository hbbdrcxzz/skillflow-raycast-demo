import { fetchRegistryJson, registrySource, RegistryUpstreamError } from "@/lib/upstream-registry";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const packs = await fetchRegistryJson<Record<string, unknown>>("/api/agent/packs");
    return Response.json({ packs, source: registrySource });
  } catch (error) {
    const message = error instanceof Error ? error.message : "无法读取 Skill Packs";
    const status = error instanceof RegistryUpstreamError ? error.status : 502;
    return Response.json({ error: { code: "PACKS_UNAVAILABLE", message } }, { status });
  }
}
