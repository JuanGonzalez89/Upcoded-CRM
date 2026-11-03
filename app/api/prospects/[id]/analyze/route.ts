import { NextResponse } from "next/server";
import { analyzeWebsite } from "@/lib/site-audit";
import { mapProspect, PROSPECT_SELECT, type DbProspect } from "@/lib/prospect-mapper";
import { requireTeamMember } from "@/lib/server-auth";

export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await requireTeamMember(request);
  if (!context) return NextResponse.json({ error: "Iniciá sesión con una cuenta del equipo para analizar un sitio." }, { status: 401 });
  const { id } = await params;
  const { supabase } = context;

  const { data: current, error: readError } = await supabase.from("prospects").select("website_url, audit").eq("id", id).single();
  if (readError || !current) return NextResponse.json({ error: "Prospecto no encontrado." }, { status: 404 });
  if (!current.website_url) return NextResponse.json({ error: "Este prospecto no tiene sitio web para analizar." }, { status: 400 });

  const result = await analyzeWebsite(current.website_url);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 502 });

  const audit = { ...(current.audit && typeof current.audit === "object" ? current.audit as Record<string, unknown> : {}), improvements: result.improvements, analyzedAt: result.checkedAt };
  const { error: updateError } = await supabase.from("prospects").update({ audit }).eq("id", id);
  if (updateError) return NextResponse.json({ error: "El análisis terminó, pero no se pudo guardar." }, { status: 500 });

  const { data, error } = await supabase.from("prospects").select(PROSPECT_SELECT).eq("id", id).single();
  if (error || !data) return NextResponse.json({ error: "El análisis se guardó, pero no se pudo releer el prospecto." }, { status: 500 });
  return NextResponse.json({ prospect: mapProspect(data as DbProspect) });
}
