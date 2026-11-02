import { NextResponse } from "next/server";
import { auditMapListing, auditSearchResult, cleanBusinessName, identityKeys, inspectWebsite, isEditorialOrDirectory, normalizeUrl } from "@/lib/prospecting";
import { findOsmBusinesses } from "@/lib/osm";
import { mapProspect, PROSPECT_SELECT, type DbProspect } from "@/lib/prospect-mapper";
import { requireTeamMember } from "@/lib/server-auth";
import type { DuplicateMatch } from "@/lib/crm";

export const maxDuration = 60;

const TARGET = 15;

type TavilyResult = { title?: string; url?: string; content?: string };
type SearchBody = { niche?: string; country?: string; province?: string; area?: string };
type Candidate = { name: string; osmId?: string; sourceUrl?: string; website?: string; phone?: string; email?: string; instagram?: string; content?: string; city?: string };

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as SearchBody | null;
  if (!body?.niche || !body.province) return NextResponse.json({ error: "Completá rubro y provincia antes de buscar." }, { status: 400 });
  const context = await requireTeamMember(request);
  if (!context) return NextResponse.json({ error: "Iniciá sesión con una cuenta del equipo para ejecutar una búsqueda." }, { status: 401 });
  const { niche, province } = body;
  const area = body.area?.trim() || undefined;
  const apiKey = process.env.TAVILY_API_KEY;

  // 1. Todo lo que ya está en el CRM (de cualquier miembro) para no volver a traerlo.
  const { data: existing, error: existingError } = await context.supabase.from("prospects").select("name, province, website_url, phone, assigned_to, state");
  if (existingError) return NextResponse.json({ error: "No se pudo leer el CRM para evitar duplicados." }, { status: 500 });
  const known = new Map<string, DuplicateMatch>();
  for (const row of existing ?? []) for (const key of identityKeys({ name: row.name, province: row.province, websiteUrl: row.website_url, phone: row.phone })) known.set(key, { name: row.name, assignedTo: row.assigned_to, state: row.state });

  // 2. Fuentes: primero lugares reales del mapa; la web sólo completa lo que falte.
  const candidates: Candidate[] = [];
  const osm = await findOsmBusinesses({ niche, province, area, limit: TARGET * 2 });
  for (const place of osm ?? []) candidates.push({ name: place.name, osmId: place.osmId, website: place.website, phone: place.phone, email: place.email, instagram: place.instagram, city: place.city });
  let editorialDiscarded = 0;
  if (candidates.length < TARGET && apiKey) {
    const query = `${niche} en ${area ? `${area}, ` : ""}${province}, ${body.country ?? "Argentina"}`;
    const response = await fetch("https://api.tavily.com/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ api_key: apiKey, query, search_depth: "advanced", max_results: 15, include_raw_content: false }), cache: "no-store" });
    if (response.ok) {
      const payload = await response.json() as { results?: TavilyResult[] };
      for (const result of payload.results ?? []) {
        if (!result.title || !result.url) continue;
        if (isEditorialOrDirectory(result.title, result.url)) { editorialDiscarded++; continue; }
        candidates.push({ name: cleanBusinessName(result.title), sourceUrl: result.url, content: result.content ?? "" });
      }
    }
  }
  if (osm === undefined && !apiKey) return NextResponse.json({ status: "configuration_required", message: "El mapa no respondió y falta TAVILY_API_KEY. La app no inventa prospectos: probá de nuevo en unos minutos." });

  // 3. Duplicados contra el CRM y dentro del propio lote.
  const duplicates: DuplicateMatch[] = [];
  const seen = new Set<string>();
  const fresh: Candidate[] = [];
  for (const candidate of candidates) {
    const keys = identityKeys({ name: candidate.name, province, websiteUrl: candidate.website ?? (candidate.osmId ? undefined : candidate.sourceUrl), phone: candidate.phone });
    const match = keys.map((key) => known.get(key)).find(Boolean);
    if (match) { if (!duplicates.some((item) => item.name === match.name)) duplicates.push(match); continue; }
    if (!keys.length || keys.some((key) => seen.has(key))) continue;
    keys.forEach((key) => seen.add(key));
    fresh.push(candidate);
    if (fresh.length >= TARGET) break;
  }

  // 4. Auditoría y alta en la bandeja temporal.
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const rows = await Promise.all(fresh.map(async (candidate) => {
    const base = candidate.osmId ? auditMapListing({ ...candidate, osmId: candidate.osmId }) : auditSearchResult({ title: candidate.name, url: candidate.sourceUrl!, content: candidate.content });
    const target = candidate.website ?? (candidate.osmId ? undefined : candidate.sourceUrl);
    const inspection = target ? await inspectWebsite(target) : undefined;
    const signals = [...base.signals.filter((signal) => !(inspection && signal === "Web publicada en el mapa")), ...(inspection?.signals ?? [])].slice(0, 7);
    const opportunity = Math.max(0, Math.min(100, base.score + (inspection?.scoreDelta ?? 0)));
    const confidence = Math.max(0, Math.min(100, base.confidence + (inspection?.confidenceDelta ?? 0)));
    const webStatus = inspection?.websiteUrl && inspection.signals.some((signal) => !signal.startsWith("Auditoría básica")) ? "Con fricción" : base.webStatus;
    return {
      owner_id: context.user.id, name: candidate.name, category: niche, country: body.country ?? "Argentina", province, locality: area ?? candidate.city ?? null, neighborhood: null,
      source_url: candidate.osmId ? `https://www.openstreetmap.org/${candidate.osmId}` : candidate.sourceUrl,
      website_url: inspection?.websiteUrl ?? normalizeUrl(candidate.website) ?? null,
      instagram_url: normalizeUrl(candidate.instagram) ?? inspection?.instagramUrl ?? null,
      phone: candidate.phone ?? inspection?.phone ?? null, email: candidate.email ?? inspection?.email ?? null,
      state: base.manualReview ? "revisar" : "nuevo", opportunity_score: opportunity, confidence_score: confidence,
      audit: { signals, webStatus, responseMs: inspection?.responseMs, manualReview: base.manualReview || !inspection?.websiteUrl, source: candidate.osmId ? "mapa" : "web" },
      source_evidence: [...base.evidence, ...(inspection?.evidence ?? [])], expires_at: expiresAt,
    };
  }));

  const summary = { mapa: fresh.filter((item) => item.osmId).length, web: fresh.filter((item) => !item.osmId).length, mapAvailable: osm !== undefined, editorialDiscarded, duplicates };
  if (!rows.length) return NextResponse.json({ status: "ok", candidates: [], ...summary });
  const { data, error } = await context.supabase.from("prospects").insert(rows).select(PROSPECT_SELECT);
  if (error) return NextResponse.json({ error: "No se pudo guardar el lote. Confirmá que ejecutaste el esquema SQL actualizado." }, { status: 500 });
  return NextResponse.json({ status: "ok", candidates: ((data ?? []) as DbProspect[]).map(mapProspect), ...summary });
}
