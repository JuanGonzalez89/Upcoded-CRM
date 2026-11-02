import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildTickets, ticketLabel, type TeamMember, type Ticket } from "@/lib/crm";
import { mapProspect, PROSPECT_SELECT, type DbProspect } from "@/lib/prospect-mapper";

// Resumen diario de pendientes por miembro. Lo dispara Vercel Cron (vercel.json) con
// Authorization: Bearer CRON_SECRET. Sin RESEND_API_KEY sólo devuelve la vista previa.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "Falta CRON_SECRET." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !serviceKey) return NextResponse.json({ error: "Falta configurar Supabase en el servidor." }, { status: 503 });

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  const [{ data: members, error: teamError }, { data: rows, error: prospectError }] = await Promise.all([
    supabase.from("team_members").select("email, display_name, initials"),
    supabase.from("prospects").select(PROSPECT_SELECT),
  ]);
  if (teamError || prospectError) return NextResponse.json({ error: "No se pudo leer el CRM." }, { status: 500 });

  const now = Date.now();
  const leads = ((rows ?? []) as DbProspect[]).map(mapProspect);
  const appUrl = process.env.APP_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "");
  const digests = (members ?? []).map((row) => {
    const member: TeamMember = { email: row.email, name: row.display_name, initials: row.initials };
    // La bandeja temporal no entra en el mail: es ruido diario y vence sola.
    const tickets = buildTickets(leads, member.email, "mios", now).filter((ticket) => ticket.kind !== "por_vencer");
    return { member, tickets, text: digestText(member, tickets, appUrl) };
  }).filter((digest) => digest.tickets.length);

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.DIGEST_FROM;
  if (!apiKey || !from) return NextResponse.json({ status: "preview", reason: "Falta RESEND_API_KEY o DIGEST_FROM: no se envió ningún mail.", digests: digests.map(({ member, tickets, text }) => ({ to: member.email, pendientes: tickets.length, text })) });

  const results = await Promise.all(digests.map(async ({ member, tickets, text }) => {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: member.email, subject: `Upcoded CRM · ${tickets.length} pendiente${tickets.length === 1 ? "" : "s"} hoy`, text }),
    });
    return { to: member.email, ok: response.ok, status: response.status };
  }));
  return NextResponse.json({ status: "sent", results });
}

function digestText(member: TeamMember, tickets: Ticket[], appUrl: string) {
  const lines = tickets.map((ticket) => `- [${ticketLabel[ticket.kind]}] ${ticket.lead.name} — ${ticket.title}${ticket.due && ticket.due !== "—" ? ` (${ticket.due})` : ""}`);
  return [`Buen día, ${member.name}.`, "", `Tenés ${tickets.length} pendiente${tickets.length === 1 ? "" : "s"} en el CRM, ordenados por urgencia:`, "", ...lines, "", ...(appUrl ? [`Abrir el CRM: ${appUrl}`, ""] : []), "Upcoded CRM"].join("\n");
}
