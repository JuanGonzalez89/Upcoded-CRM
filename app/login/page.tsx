"use client";

import { ArrowLeft, LoaderCircle, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase-browser";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function signIn() {
    if (!isSupabaseConfigured) return;
    setLoading(true); setError("");
    const { error: oauthError } = await getSupabaseBrowserClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/` } });
    if (oauthError) { setError("No se pudo iniciar Google. Revisá la configuración OAuth de Supabase."); setLoading(false); }
  }
  return <main className="login-shell"><section className="login-panel"><div className="login-logo"><span aria-hidden="true">››</span><strong>UpCoded <i>/dev</i></strong></div><div><p className="login-label">OPERATIONS</p><h1>Un espacio privado para operar mejor.</h1><p>Esta instalación está restringida a la cuenta administrativa de Upcoded.</p></div>{isSupabaseConfigured ? <button className="login-button" onClick={signIn} disabled={loading}>{loading ? <LoaderCircle className="spin" size={18} /> : <ShieldCheck size={18} />}{loading ? "Abriendo Google…" : "Continuar con Google"}</button> : <div className="login-config"><ShieldCheck size={18} /><div><strong>Modo local activo</strong><span>Agregá las claves de Supabase para habilitar el acceso con Google.</span></div></div>}{error && <p className="login-error">{error}</p>}<a href="/" className="back-link"><ArrowLeft size={15} /> Volver a la aplicación</a></section></main>;
}
