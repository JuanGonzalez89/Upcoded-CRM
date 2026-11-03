// Análisis profundo y a demanda de un sitio: busca puntos de mejora concretos para citar en el
// primer contacto. Sólo se corre sobre un prospecto puntual (botón "Analizar web" en la ficha),
// nunca sobre un lote de búsqueda: tarda más que la auditoría rápida y no entraría en los 60 s
// de la función de búsqueda. Cada hallazgo sale de algo verificable (HTML recibido, robots.txt,
// sitemap.xml o el propio Google PageSpeed); si no se puede confirmar, no se informa.

export type Improvement = { title: string; detail: string; evidence?: string };

const HEADERS = { "User-Agent": "UpcodedCRM/1.0 (analisis de sitio a pedido del equipo)" };

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: HEADERS, redirect: "follow", cache: "no-store" });
    return { ok: response.ok, status: response.status, text: await response.text() };
  } catch { return undefined; }
  finally { clearTimeout(timer); }
}

/** Puntos de mejora que se pueden confirmar directamente en el HTML recibido. */
export function extractHtmlImprovements(html: string): Improvement[] {
  const improvements: Improvement[] = [];

  const images = html.match(/<img\b[^>]*>/gi) ?? [];
  // [\s<] y no \b: "data-alt=" también cumple \balt\b (el guion cuenta como límite de palabra).
  const withoutAlt = images.filter((tag) => !/[\s<]alt\s*=\s*["'][^"']+["']/i.test(tag)).length;
  if (withoutAlt > 0) improvements.push({
    title: `${withoutAlt} imagen${withoutAlt === 1 ? "" : "es"} sin texto alternativo`,
    detail: `tiene ${withoutAlt} imagen${withoutAlt === 1 ? "" : "es"} sin texto alternativo (alt), algo que afecta el SEO y la accesibilidad`,
  });

  if (!/<h1[\s>]/i.test(html)) improvements.push({
    title: "Sin encabezado principal (H1)",
    detail: "la página no tiene un encabezado principal (H1), algo que Google usa para entender de qué se trata",
  });

  if (!/<link[^>]+rel=["'](?:shortcut )?icon["']/i.test(html)) improvements.push({
    title: "Sin ícono de pestaña (favicon)",
    detail: "no tiene favicon configurado, un detalle chico pero que se nota en el navegador y en los resultados de Google",
  });

  const year = Number(html.match(/©\s*(\d{4})/)?.[1] ?? html.match(/copyright\s*©?\s*(\d{4})/i)?.[1]);
  const currentYear = new Date().getFullYear();
  if (year && year < currentYear - 1) improvements.push({
    title: `El pie de página dice ${year}`,
    detail: `el pie de página todavía dice ${year}, lo que da la sensación de que no se actualiza hace tiempo`,
  });

  return improvements;
}

/** robots.txt y sitemap.xml son básicos para que Google indexe bien el sitio; ausentes, cuentan. */
async function checkRobotsAndSitemap(origin: string): Promise<Improvement[]> {
  const [robots, sitemap] = await Promise.all([fetchWithTimeout(`${origin}/robots.txt`, 5000), fetchWithTimeout(`${origin}/sitemap.xml`, 5000)]);
  const improvements: Improvement[] = [];
  if (!robots?.ok) improvements.push({ title: "Sin archivo robots.txt", detail: "no tiene robots.txt, el archivo básico que le indica a Google qué puede rastrear del sitio" });
  if (!sitemap?.ok) improvements.push({ title: "Sin sitemap.xml", detail: "no tiene sitemap.xml, lo que le puede dificultar a Google encontrar todas sus páginas" });
  return improvements;
}

type PageSpeedAudit = { title?: string; score?: number | null; displayValue?: string };
type PageSpeedPayload = { lighthouseResult?: { categories?: Record<string, { score?: number }>; audits?: Record<string, PageSpeedAudit> } };
const CATEGORY_LABEL: Record<string, string> = { performance: "rendimiento mobile", seo: "SEO", accessibility: "accesibilidad" };

/**
 * Opcional: si hay GOOGLE_PAGESPEED_API_KEY, suma el propio diagnóstico de Google (gratis), con
 * números que el cliente puede verificar él mismo. Se usa tal cual el texto que devuelve Google
 * (locale=es): no se redacta ni se traduce a mano para no introducir un hallazgo inexacto.
 */
export async function fetchPageSpeedImprovements(url: string): Promise<Improvement[]> {
  const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY;
  if (!apiKey) return [];
  const params = new URLSearchParams({ url, strategy: "mobile", locale: "es", key: apiKey });
  for (const category of ["performance", "seo", "accessibility"]) params.append("category", category);
  const page = await fetchWithTimeout(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params}`, 25000);
  if (!page?.ok) return [];
  try {
    const payload = JSON.parse(page.text) as PageSpeedPayload;
    const categories = payload.lighthouseResult?.categories ?? {};
    const audits = Object.values(payload.lighthouseResult?.audits ?? {});
    const improvements: Improvement[] = [];
    for (const [key, label] of Object.entries(CATEGORY_LABEL)) {
      const score = categories[key]?.score;
      if (typeof score === "number" && score < 0.5) improvements.push({
        title: `${label[0].toUpperCase()}${label.slice(1)}: ${Math.round(score * 100)}/100 según Google`,
        detail: `Google le mide ${Math.round(score * 100)}/100 en ${label}`,
        evidence: "Google PageSpeed Insights (mobile)",
      });
    }
    const failing = audits.filter((audit): audit is Required<Pick<PageSpeedAudit, "title" | "score">> & PageSpeedAudit => typeof audit.score === "number" && audit.score < 0.9 && Boolean(audit.title))
      .sort((a, b) => (a.score ?? 1) - (b.score ?? 1)).slice(0, 4);
    for (const audit of failing) improvements.push({
      title: audit.title!,
      detail: `${audit.title}${audit.displayValue ? ` (${audit.displayValue})` : ""}`,
      evidence: "Google PageSpeed Insights (mobile)",
    });
    return improvements;
  } catch { return []; }
}

export async function analyzeWebsite(url: string): Promise<{ improvements: Improvement[]; checkedAt: string } | { error: string }> {
  let target: URL;
  try { target = new URL(url); } catch { return { error: "La URL del sitio no es válida." }; }

  const page = await fetchWithTimeout(target.toString(), 8000);
  if (!page) return { error: "No se pudo cargar el sitio dentro del límite de tiempo." };
  if ([401, 403, 429, 503].includes(page.status)) return { error: `El sitio bloqueó el análisis automático (estado ${page.status}): revisalo a mano.` };
  if (!page.ok) return { error: `El sitio respondió con estado ${page.status}: no se pudo analizar el contenido.` };

  const [robotsSitemap, pagespeed] = await Promise.all([checkRobotsAndSitemap(target.origin), fetchPageSpeedImprovements(target.toString())]);
  return { improvements: [...extractHtmlImprovements(page.text), ...robotsSitemap, ...pagespeed], checkedAt: new Date().toISOString() };
}
