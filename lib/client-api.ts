"use client";

import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase-browser";

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

/** fetch contra las rutas propias, con el token de Supabase cuando hay sesión. */
export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (isSupabaseConfigured) {
    const { data } = await getSupabaseBrowserClient().auth.getSession();
    if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
  }
  const response = await fetch(path, { method: init.method ?? "GET", headers, body: init.body === undefined ? undefined : JSON.stringify(init.body) });
  const payload = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new ApiError(payload.error ?? "La operación no se pudo completar.", response.status);
  return payload;
}

export function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch { return fallback; }
}

export function writeLocal(key: string, value: unknown) {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* almacenamiento no disponible */ }
}
