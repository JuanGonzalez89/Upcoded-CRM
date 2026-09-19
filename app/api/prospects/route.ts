import { NextResponse } from "next/server";
import { mapProspect } from "@/lib/prospect-mapper";
import { requireUpcodedAdmin } from "@/lib/server-auth";

export async function GET(request: Request) {
  const context = await requireUpcodedAdmin(request);
  if (!context) return NextResponse.json({ error: "Sesión no autorizada." }, { status: 401 });

  await context.supabase.from("prospects").delete().lt("expires_at", new Date().toISOString()).in("state", ["nuevo", "revisar", "descartado"]);
  const { data, error } = await context.supabase.from("prospects").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "No se pudo leer el CRM. Verificá que el esquema SQL esté ejecutado." }, { status: 500 });
  return NextResponse.json({ prospects: (data ?? []).map(mapProspect) });
}
