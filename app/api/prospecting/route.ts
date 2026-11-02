import { NextResponse } from "next/server";
import { auditSearchResult, cleanBusinessName, inspectWebsite, isLikelyDuplicate } from "@/lib/prospecting";
import { mapProspect, PROSPECT_SELECT, type DbProspect } from "@/lib/prospect-mapper";
import { requireTeamMember } from "@/lib/server-auth";

type TavilyResult = { title?: string; url?: string; content?: string };
type SearchBody = { niche?: string; country?: string; province?: string; area?: string };

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as SearchBody | null;
  if (!body?.niche || !body.province) return NextResponse.json({ error: "Completá rubro y provincia antes de buscar." }, { status: 400 });
  const context = await requireTeamMember(request);
  if (!context) return NextResponse.json({ error: "Iniciá sesión con una cuenta del equipo para ejecutar una búsqueda." }, { status: 401 });
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return NextResponse.json({ status: "configuration_required", message: "Falta TAVILY_API_KEY. La app no inventará prospectos ni hará búsquedas sin una fuente configurada." });

  // Sin zona, la búsqueda cubre toda la provincia; la zona sólo la acota.
  const area = body.area?.trim() || undefined;
  const query = `${body.niche} en ${area ? `${area}, ` : ""}${body.province}, ${body.country ?? "Argentina"}`;
  const response = await fetch("https://api.tavily.com/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ api_key: apiKey, query, search_depth: "advanced", max_results: 10, include_raw_content: false }), cache: "no-store" });
  if (!response.ok) return NextResponse.json({ error: "La fuente de búsqueda no respondió. Revisá la cuota y la clave de Tavily." }, { status: 502 });
  const payload = await response.json() as { results?: TavilyResult[] };
  const rawCandidates = (payload.results ?? []).filter((result) => result.title && result.url).map((result) => ({ name: cleanBusinessName(result.title!), url: result.url!, content: result.content ?? "" })).filter((candidate, index, all) => !all.slice(0, index).some((other) => isLikelyDuplicate({ name: candidate.name, location: area ?? body.province! }, { name: other.name, location: area ?? body.province! })));
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const rows = await Promise.all(rawCandidates.map(async (candidate) => {
    const base = auditSearchResult({ title: candidate.name, url: candidate.url, content: candidate.content });
    const inspection = await inspectWebsite(candidate.url);
    const signals = [...base.signals, ...inspection.signals].slice(0, 7);
    const evidence = [...base.evidence, ...inspection.evidence];
    const opportunity = Math.max(0, Math.min(100, base.score + inspection.scoreDelta));
    const confidence = Math.max(0, Math.min(100, base.confidence + inspection.confidenceDelta));
    const webStatus = inspection.websiteUrl && inspection.signals.some((signal) => !signal.startsWith("Auditoría básica")) ? "Con fricción" : base.webStatus;
    return { owner_id: context.user.id, name: candidate.name, category: body.niche, country: body.country ?? "Argentina", province: body.province, locality: area ?? null, neighborhood: null, source_url: candidate.url, website_url: inspection.websiteUrl ?? null, instagram_url: inspection.instagramUrl ?? null, state: base.manualReview ? "revisar" : "nuevo", opportunity_score: opportunity, confidence_score: confidence, audit: { signals, webStatus, responseMs: inspection.responseMs, manualReview: base.manualReview || !inspection.websiteUrl }, source_evidence: evidence, expires_at: expiresAt };
  }));
  if (!rows.length) return NextResponse.json({ status: "ok", candidates: [] });
  const { data, error } = await context.supabase.from("prospects").insert(rows).select(PROSPECT_SELECT);
  if (error) return NextResponse.json({ error: "No se pudo guardar el lote. Confirmá que ejecutaste el esquema SQL actualizado." }, { status: 500 });
  return NextResponse.json({ status: "ok", query, candidates: ((data ?? []) as DbProspect[]).map(mapProspect) });
}
