import { NextResponse } from "next/server";
import { addDays, channelLabel, DEFAULT_SETTINGS, formatDate, PIPELINE_STAGES, stageLabel, TEMPORARY_STAGES, type Channel, type LeadPatch, type Settings, type Stage } from "@/lib/crm";
import { mapProspect, PROSPECT_SELECT, type DbProspect } from "@/lib/prospect-mapper";
import { requireTeamMember } from "@/lib/server-auth";

const STAGES = new Set<Stage>([...TEMPORARY_STAGES, ...PIPELINE_STAGES]);
const CHANNELS = new Set<Channel>(["whatsapp", "email", "instagram"]);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await requireTeamMember(request);
  if (!context) return NextResponse.json({ error: "Sesión no autorizada." }, { status: 401 });
  const patch = await request.json().catch(() => null) as LeadPatch | null;
  if (!patch || typeof patch !== "object") return NextResponse.json({ error: "Cambio inválido." }, { status: 400 });
  if (patch.state && !STAGES.has(patch.state)) return NextResponse.json({ error: "Etapa inválida." }, { status: 400 });
  if (patch.contact && (!CHANNELS.has(patch.contact.channel) || !patch.contact.body?.trim())) return NextResponse.json({ error: "Mensaje inválido." }, { status: 400 });

  const { id } = await params;
  const { supabase, user, member } = context;
  const { data: current, error: readError } = await supabase.from("prospects").select("*").eq("id", id).single();
  if (readError || !current) return NextResponse.json({ error: "Prospecto no encontrado." }, { status: 404 });

  let assigneeName = "";
  if (patch.assignedTo) {
    const { data: assignee } = await supabase.from("team_members").select("display_name").eq("email", patch.assignedTo).maybeSingle();
    if (!assignee) return NextResponse.json({ error: "Ese miembro no pertenece al equipo." }, { status: 400 });
    assigneeName = assignee.display_name;
  }

  const now = new Date().toISOString();
  const update: Record<string, unknown> = {};
  const activity: { kind: string; body: string }[] = [];
  let state = current.state as Stage;

  if (patch.state && patch.state !== state) {
    activity.push({ kind: "estado", body: `${stageLabel[state]} → ${stageLabel[patch.state]}` });
    state = patch.state;
    update.state = state;
    if (!TEMPORARY_STAGES.includes(state)) { update.expires_at = null; if (!current.saved_at) update.saved_at = now; }
    if (state === "guardado" && !current.assigned_to && patch.assignedTo === undefined) update.assigned_to = member.email;
  }
  if (patch.assignedTo !== undefined && patch.assignedTo !== current.assigned_to) {
    update.assigned_to = patch.assignedTo;
    activity.push({ kind: "asignacion", body: patch.assignedTo ? `Asignado a ${assigneeName}` : "Sin responsable" });
  }
  if (typeof patch.notes === "string") update.notes = patch.notes.slice(0, 5000);
  if (typeof patch.phone === "string") update.phone = patch.phone.trim().slice(0, 40);
  if (typeof patch.email === "string") update.email = patch.email.trim().toLowerCase().slice(0, 120);
  if (patch.nextFollowUpAt !== undefined) {
    const value = patch.nextFollowUpAt && !Number.isNaN(Date.parse(patch.nextFollowUpAt)) ? new Date(patch.nextFollowUpAt).toISOString() : null;
    update.next_follow_up_at = value;
    activity.push({ kind: "seguimiento", body: value ? `Seguimiento para el ${formatDate(value)}` : "Seguimiento quitado" });
  }
  if (patch.note?.trim()) activity.push({ kind: "nota", body: patch.note.trim().slice(0, 2000) });

  if (patch.contact) {
    const { data: stored } = await supabase.from("crm_settings").select("value").eq("key", "workspace").maybeSingle();
    const settings = { ...DEFAULT_SETTINGS, ...(stored?.value as Partial<Settings> | undefined) };
    const { error: messageError } = await supabase.from("prospect_messages").insert({ prospect_id: id, owner_id: user.id, actor_email: member.email, channel: patch.contact.channel, body: patch.contact.body.slice(0, 4000) });
    if (messageError) return NextResponse.json({ error: "No se pudo registrar el mensaje." }, { status: 500 });
    update.last_contacted_at = now;
    update.last_contacted_by = member.email;
    update.next_follow_up_at = addDays(settings.followUpDays);
    update.expires_at = null;
    if (!current.assigned_to && update.assigned_to === undefined) update.assigned_to = member.email;
    if (["guardado", "nuevo", "revisar", "contactado"].includes(state)) update.state = "contactado";
    activity.push({ kind: "contacto", body: `Mensaje por ${channelLabel[patch.contact.channel]}` });
  }

  if (Object.keys(update).length) {
    const { error } = await supabase.from("prospects").update(update).eq("id", id);
    if (error) return NextResponse.json({ error: "No se pudo actualizar el prospecto." }, { status: 500 });
  }
  if (activity.length) await supabase.from("prospect_activity").insert(activity.map((item) => ({ ...item, prospect_id: id, actor_email: member.email })));

  const { data, error } = await supabase.from("prospects").select(PROSPECT_SELECT).eq("id", id).single();
  if (error || !data) return NextResponse.json({ error: "El cambio se guardó, pero no se pudo releer el prospecto." }, { status: 500 });
  return NextResponse.json({ prospect: mapProspect(data as DbProspect) });
}
