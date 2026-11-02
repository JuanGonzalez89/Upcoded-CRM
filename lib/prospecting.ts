export type EvidenceKind = "website" | "social" | "directory" | "search";

export type ProspectEvidence = {
  kind: EvidenceKind;
  label: string;
  url?: string;
};

export type ProspectAudit = {
  score: number;
  confidence: number;
  webStatus: "No localizada" | "Revisión manual" | "Con fricción" | "Web detectada";
  signals: string[];
  evidence: ProspectEvidence[];
  manualReview: boolean;
};

export type WebsiteInspection = { websiteUrl?: string; instagramUrl?: string; responseMs?: number; signals: string[]; evidence: ProspectEvidence[]; scoreDelta: number; confidenceDelta: number };

export function cleanBusinessName(value: string) {
  return value
    .replace(/[|–—-].*$/, "")
    .replace(/\b(Instagram|Facebook|Google Maps|Argentina)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeUrl(value?: string) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    url.hash = "";
    url.search = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return undefined;
  }
}

export function auditSearchResult(input: { title: string; url: string; content?: string }): ProspectAudit {
  const sourceUrl = normalizeUrl(input.url);
  const text = `${input.title} ${input.content ?? ""}`.toLowerCase();
  const host = sourceUrl ? new URL(sourceUrl).hostname.replace(/^www\./, "") : "";
  const isSocial = /instagram\.com|facebook\.com|linkedin\.com|tiktok\.com/.test(host);
  const isDirectory = /google\.com|maps\.app|cylex|guiade|foursquare/.test(host);
  const hasWebsiteLanguage = /sitio web|website|www\.|\.com\b|\.com\.ar\b|\.ar\b/.test(text);
  const contactFriction = /instagram|whatsapp|facebook/.test(text) && !/contacto|turnos|reserv/.test(text);

  const evidence: ProspectEvidence[] = [{
    kind: isSocial ? "social" : isDirectory ? "directory" : "search",
    label: isSocial ? `Perfil social localizado: ${host}` : isDirectory ? `Directorio localizado: ${host}` : `Resultado localizado: ${host || "fuente web"}`,
    url: sourceUrl,
  }];

  if (isSocial) {
    return { score: 72, confidence: 56, webStatus: "Revisión manual", manualReview: true, evidence, signals: ["Se encontró una red social", "La bio puede contener un enlace a su sitio", "No afirmar “sin web” hasta revisarlo"] };
  }
  if (isDirectory) {
    return { score: 64, confidence: 48, webStatus: "Revisión manual", manualReview: true, evidence, signals: ["Aparece en un directorio", "La identidad y el sitio requieren confirmación", "No se asigna dominio por coincidencia de nombre"] };
  }
  if (hasWebsiteLanguage) {
    return { score: contactFriction ? 74 : 42, confidence: 78, webStatus: contactFriction ? "Con fricción" : "Web detectada", manualReview: false, evidence, signals: contactFriction ? ["Web o enlace detectado", "El contacto parece depender de redes", "Conviene revisar experiencia móvil"] : ["Web detectada en una fuente pública", "No se clasifica como mala sin auditoría técnica"] };
  }
  return { score: 79, confidence: 68, webStatus: "No localizada", manualReview: true, evidence, signals: ["No se localizó un sitio en este resultado", "No es evidencia suficiente para afirmar que no tiene web", "Revisión manual recomendada"] };
}

export function isLikelyDuplicate(a: { name: string; location: string }, b: { name: string; location: string }) {
  const normalize = (value: string) => cleanBusinessName(value).toLocaleLowerCase("es-AR").replace(/[^a-z0-9]/g, "");
  return normalize(a.name) === normalize(b.name) && normalize(a.location) === normalize(b.location);
}

export async function inspectWebsite(url?: string): Promise<WebsiteInspection> {
  const websiteUrl = normalizeUrl(url);
  if (!websiteUrl) return { signals: ["No se pudo validar la URL"], evidence: [], scoreDelta: 0, confidenceDelta: -8 };
  const host = new URL(websiteUrl).hostname.replace(/^www\./, "");
  if (/instagram\.com|facebook\.com|linkedin\.com|tiktok\.com|google\.com|maps\.app/.test(host)) return { signals: ["La fuente es una red o directorio; requiere validación humana"], evidence: [], scoreDelta: 0, confidenceDelta: 0 };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  const started = Date.now();
  try {
    const response = await fetch(websiteUrl, { signal: controller.signal, redirect: "follow", headers: { "User-Agent": "UpcodedCRM/1.0 audit" } });
    const responseMs = Date.now() - started;
    const html = (await response.text()).slice(0, 250000);
    const lower = html.toLowerCase();
    const signals: string[] = [];
    const evidence: ProspectEvidence[] = [{ kind: "website", label: `Sitio accesible (${response.status}) · ${responseMs} ms`, url: websiteUrl }];
    let scoreDelta = 0;
    let confidenceDelta = 18;
    const instagram = html.match(/https?:\/\/(?:www\.)?instagram\.com\/[^"'\s<>?#]+/i)?.[0];
    if (!response.ok) { signals.push(`El sitio respondió con estado ${response.status}`); scoreDelta += 22; confidenceDelta += 8; }
    if (!/name=["']viewport["']/i.test(html)) { signals.push("No se detectó etiqueta viewport para móvil"); scoreDelta += 16; }
    if (!/<title[^>]*>[^<]{8,}/i.test(html)) { signals.push("Título SEO ausente o demasiado corto"); scoreDelta += 10; }
    if (!/name=["']description["']/i.test(html)) { signals.push("Meta descripción no detectada"); scoreDelta += 8; }
    if (!/<form\b|mailto:|wa\.me|api\.whatsapp\.com/i.test(lower)) { signals.push("No se detectó formulario ni canal de contacto directo"); scoreDelta += 14; }
    if (responseMs > 3500) { signals.push(`Respuesta lenta: ${Math.round(responseMs / 100) / 10} s`); scoreDelta += 12; }
    if (websiteUrl.startsWith("http:")) { signals.push("El sitio no usa HTTPS"); scoreDelta += 18; }
    if (instagram) evidence.push({ kind: "social", label: "El sitio enlaza a un perfil de Instagram", url: normalizeUrl(instagram) });
    if (!signals.length) signals.push("Auditoría básica: no se encontraron fricciones técnicas claras");
    return { websiteUrl, instagramUrl: normalizeUrl(instagram), responseMs, signals, evidence, scoreDelta, confidenceDelta };
  } catch {
    return { websiteUrl, signals: ["No se pudo cargar el sitio para auditarlo"], evidence: [{ kind: "website", label: "La URL no respondió dentro del límite de auditoría", url: websiteUrl }], scoreDelta: 20, confidenceDelta: 6 };
  } finally { clearTimeout(timeout); }
}
