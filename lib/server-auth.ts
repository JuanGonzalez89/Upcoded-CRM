import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import type { TeamMember } from "@/lib/crm";

export type AuthenticatedContext = { supabase: SupabaseClient; user: User; member: TeamMember };

/** Valida el token y exige que el email figure en public.team_members (única lista de acceso). */
export async function requireTeamMember(request: Request): Promise<AuthenticatedContext | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !key || !token) return null;

  const supabase = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: { user } } = await supabase.auth.getUser(token);
  const email = user?.email?.toLowerCase();
  if (!user || !email) return null;
  const { data } = await supabase.from("team_members").select("email, display_name, initials").eq("email", email).maybeSingle();
  if (!data) return null;
  return { supabase, user, member: { email: data.email, name: data.display_name, initials: data.initials } };
}
