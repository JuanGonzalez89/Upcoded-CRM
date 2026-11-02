import { NextResponse } from "next/server";
import { mapProspect, PROSPECT_SELECT, type DbProspect } from "@/lib/prospect-mapper";
import { requireTeamMember } from "@/lib/server-auth";

export async function GET(request: Request) {
  const context = await requireTeamMember(request);
  if (!context) return NextResponse.json({ error: "Sesión no autorizada." }, { status: 401 });

  await context.supabase.from("prospects").delete().lt("expires_at", new Date().toISOString()).in("state", ["nuevo", "revisar", "descartado"]);
  const { data, error } = await context.supabase.from("prospects").select(PROSPECT_SELECT).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "No se pudo leer el CRM. Verificá que ejecutaste supabase/003_team.sql." }, { status: 500 });
  return NextResponse.json({ prospects: ((data ?? []) as DbProspect[]).map(mapProspect) });
}
