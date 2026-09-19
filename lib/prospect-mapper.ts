type DbProspect = {
  id: string; name: string; category: string; province: string | null; locality: string | null; neighborhood: string | null;
  state: string; opportunity_score: number | null; confidence_score: number | null; audit: unknown; source_evidence: unknown;
  source_url: string | null; expires_at: string | null;
};

const stateMap: Record<string, "Nuevo" | "Revisar" | "Guardado"> = { nuevo: "Nuevo", revisar: "Revisar", guardado: "Guardado", contactado: "Guardado", respondio: "Guardado", cliente: "Guardado", no_contactar: "Guardado", descartado: "Revisar" };

export function mapProspect(row: DbProspect) {
  const audit = (row.audit && typeof row.audit === "object" ? row.audit : {}) as { signals?: string[]; webStatus?: "No localizada" | "Revisión manual" | "Con fricción" | "Web detectada" };
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    location: [row.neighborhood, row.locality, row.province].filter(Boolean).join(", "),
    state: stateMap[row.state] ?? "Revisar",
    score: row.opportunity_score ?? 0,
    confidence: row.confidence_score ?? 0,
    site: audit.webStatus ?? "Revisión manual",
    signals: audit.signals ?? ["Sin señales registradas"],
    sourceUrl: row.source_url ?? undefined,
    expires: row.expires_at ?? "",
    expiresAt: row.expires_at ? Date.parse(row.expires_at) : undefined,
  };
}
