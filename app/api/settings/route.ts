import { NextResponse } from "next/server";
import { DEFAULT_SETTINGS, type Settings } from "@/lib/crm";
import { requireTeamMember } from "@/lib/server-auth";

function services() {
  return { supabase: true, tavily: Boolean(process.env.TAVILY_API_KEY), pagespeed: Boolean(process.env.GOOGLE_PAGESPEED_API_KEY) };
}

export async function GET(request: Request) {
  const context = await requireTeamMember(request);
  if (!context) return NextResponse.json({ error: "Sesión no autorizada." }, { status: 401 });
  const { data } = await context.supabase.from("crm_settings").select("value").eq("key", "workspace").maybeSingle();
  const stored = (data?.value ?? {}) as Partial<Settings>;
  return NextResponse.json({ settings: { ...DEFAULT_SETTINGS, ...stored, templates: { ...DEFAULT_SETTINGS.templates, ...stored.templates } }, services: services() });
}

export async function PUT(request: Request) {
  const context = await requireTeamMember(request);
  if (!context) return NextResponse.json({ error: "Sesión no autorizada." }, { status: 401 });
  const body = await request.json().catch(() => null) as Settings | null;
  const followUpDays = Math.round(Number(body?.followUpDays));
  if (!body || !Number.isFinite(followUpDays) || followUpDays < 1 || followUpDays > 60) return NextResponse.json({ error: "Los días de seguimiento deben estar entre 1 y 60." }, { status: 400 });
  const templates = Object.fromEntries(Object.entries(DEFAULT_SETTINGS.templates).map(([key, fallback]) => [key, String(body.templates?.[key as keyof Settings["templates"]] ?? fallback).slice(0, 3000)]));
  const settings = { followUpDays, signature: String(body.signature ?? "").slice(0, 200), templates } as Settings;
  const { error } = await context.supabase.from("crm_settings").upsert({ key: "workspace", value: settings, updated_by: context.member.email, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: "No se pudo guardar la configuración." }, { status: 500 });
  return NextResponse.json({ settings, services: services() });
}
