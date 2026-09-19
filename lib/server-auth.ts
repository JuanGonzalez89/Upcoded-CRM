import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

export type AuthenticatedContext = { supabase: SupabaseClient; user: User };

export async function requireUpcodedAdmin(request: Request): Promise<AuthenticatedContext | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !key || !token) return null;

  const supabase = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: { user } } = await supabase.auth.getUser(token);
  const adminEmail = (process.env.UPCODED_ADMIN_EMAIL ?? "upcodednow@gmail.com").toLowerCase();
  if (!user || user.email?.toLowerCase() !== adminEmail) return null;
  return { supabase, user };
}
