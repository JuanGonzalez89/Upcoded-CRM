import type { Lead, Stage, WebStatus } from "@/lib/crm";

type DbActivity = { id: string; kind: string; body: string; actor_email: string; created_at: string };
type DbMessage = { id: string; channel: string; body: string; actor_email: string | null; created_at: string };

export type DbProspect = {
  id: string; name: string; category: string; province: string | null; locality: string | null; neighborhood: string | null;
  state: string; opportunity_score: number | null; confidence_score: number | null; audit: unknown; source_evidence: unknown;
  source_url: string | null; website_url: string | null; instagram_url: string | null; expires_at: string | null; created_at: string;
  phone?: string | null; email?: string | null; notes?: string | null; assigned_to?: string | null;
  last_contacted_at?: string | null; last_contacted_by?: string | null; next_follow_up_at?: string | null;
  prospect_activity?: DbActivity[]; prospect_messages?: DbMessage[];
};

export const PROSPECT_SELECT = "*, prospect_activity(id, kind, body, actor_email, created_at), prospect_messages(id, channel, body, actor_email, created_at)";

const byNewest = (a: { at: string }, b: { at: string }) => b.at.localeCompare(a.at);

export function mapProspect(row: DbProspect): Lead {
  const audit = (row.audit && typeof row.audit === "object" ? row.audit : {}) as { signals?: string[]; webStatus?: WebStatus };
  const evidence = Array.isArray(row.source_evidence) ? row.source_evidence as { label: string; url?: string }[] : [];
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    province: row.province ?? "",
    locality: row.locality ?? "",
    location: [row.neighborhood && row.neighborhood !== row.locality ? row.neighborhood : null, row.locality, row.province].filter(Boolean).join(", "),
    state: row.state as Stage,
    score: row.opportunity_score ?? 0,
    confidence: row.confidence_score ?? 0,
    site: audit.webStatus ?? "Revisión manual",
    signals: audit.signals ?? ["Sin señales registradas"],
    evidence,
    sourceUrl: row.source_url ?? undefined,
    websiteUrl: row.website_url ?? undefined,
    instagramUrl: row.instagram_url ?? undefined,
    phone: row.phone ?? "",
    email: row.email ?? "",
    notes: row.notes ?? "",
    assignedTo: row.assigned_to ?? undefined,
    lastContactedAt: row.last_contacted_at ?? undefined,
    lastContactedBy: row.last_contacted_by ?? undefined,
    nextFollowUpAt: row.next_follow_up_at ?? undefined,
    expiresAt: row.expires_at ? Date.parse(row.expires_at) : undefined,
    createdAt: row.created_at,
    activity: (row.prospect_activity ?? []).map((item) => ({ id: item.id, kind: item.kind, body: item.body, actor: item.actor_email, at: item.created_at })).sort(byNewest),
    messages: (row.prospect_messages ?? []).map((item) => ({ id: item.id, channel: item.channel, body: item.body, actor: item.actor_email ?? "", at: item.created_at })).sort(byNewest),
  };
}
