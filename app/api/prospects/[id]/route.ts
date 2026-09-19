import { NextResponse } from "next/server";
import { mapProspect } from "@/lib/prospect-mapper";
import { requireUpcodedAdmin } from "@/lib/server-auth";

const stateMap: Record<string, string> = { Nuevo: "nuevo", Revisar: "revisar", Guardado: "guardado" };

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await requireUpcodedAdmin(request);
  if (!context) return NextResponse.json({ error: "Sesión no autorizada." }, { status: 401 });
  const body = await request.json().catch(() => null) as { state?: string } | null;
  const state = body?.state ? stateMap[body.state] : undefined;
  if (!state) return NextResponse.json({ error: "Estado inválido." }, { status: 400 });
  const { id } = await params;
  const update = state === "guardado" ? { state, saved_at: new Date().toISOString(), expires_at: null } : { state };
  const { data, error } = await context.supabase.from("prospects").update(update).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: "No se pudo actualizar el prospecto." }, { status: 500 });
  return NextResponse.json({ prospect: mapProspect(data) });
}
