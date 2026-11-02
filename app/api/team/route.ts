import { NextResponse } from "next/server";
import { requireTeamMember } from "@/lib/server-auth";

export async function GET(request: Request) {
  const context = await requireTeamMember(request);
  if (!context) return NextResponse.json({ error: "Tu cuenta no forma parte del equipo de Upcoded." }, { status: 401 });
  const { data, error } = await context.supabase.from("team_members").select("email, display_name, initials").order("created_at");
  if (error) return NextResponse.json({ error: "No se pudo leer el equipo." }, { status: 500 });
  return NextResponse.json({ me: context.member, team: (data ?? []).map((row) => ({ email: row.email, name: row.display_name, initials: row.initials })) });
}

export async function PATCH(request: Request) {
  const context = await requireTeamMember(request);
  if (!context) return NextResponse.json({ error: "Sesión no autorizada." }, { status: 401 });
  const body = await request.json().catch(() => null) as { name?: string; initials?: string } | null;
  const name = body?.name?.trim().slice(0, 60);
  const initials = body?.initials?.trim().toUpperCase().slice(0, 3);
  if (!name || !initials) return NextResponse.json({ error: "Completá nombre e iniciales." }, { status: 400 });
  const { error } = await context.supabase.from("team_members").update({ display_name: name, initials }).eq("email", context.member.email);
  if (error) return NextResponse.json({ error: "No se pudo actualizar el perfil." }, { status: 500 });
  return NextResponse.json({ me: { email: context.member.email, name, initials } });
}
