import { CheckCircle2, CircleAlert, Database, Download, ListChecks, LogOut, Radar, RotateCcw, Save, UserRoundCog, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { channelLabel, DEFAULT_SETTINGS, isTemporary, type Settings, type Templates } from "@/lib/crm";
import { Avatar, type PanelProps } from "@/app/components/ui";

export type Services = { supabase: boolean; tavily: boolean; pagespeed: boolean };

const templateLabel: Record<keyof Templates, string> = { ...channelLabel, seguimiento: "Seguimiento (sin respuesta)" };

export function SettingsPanel({ leads, team, me, settings, services, onSaveSettings, onSaveProfile, onSwitchAccount, canSwitchLocally }: PanelProps & { services: Services; onSaveSettings: (settings: Settings) => Promise<void>; onSaveProfile: (name: string, initials: string) => Promise<void>; onSwitchAccount: (email?: string) => Promise<void>; canSwitchLocally: boolean }) {
  const [name, setName] = useState(me.name);
  const [initials, setInitials] = useState(me.initials);
  const [draft, setDraft] = useState<Settings>(settings);

  useEffect(() => { setName(me.name); setInitials(me.initials); }, [me.name, me.initials]);
  useEffect(() => setDraft(settings), [settings]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);

  function exportJson() {
    const data = { exportedAt: new Date().toISOString(), team, prospects: leads.filter((lead) => !isTemporary(lead)) };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const link = Object.assign(document.createElement("a"), { href: url, download: `upcoded-crm-backup-${new Date().toISOString().slice(0, 10)}.json` });
    link.click();
    URL.revokeObjectURL(url);
  }

  return <>
    <div className="page-heading"><div><h1>Configuración.</h1><p className="lede">Tu perfil, el equipo, cómo suenan los mensajes y cada cuántos días volver a contactar. Los cambios de plantillas y seguimiento aplican a los dos miembros.</p></div></div>

    <div className="settings-grid">
      <section className="settings-card">
        <h2>Mi perfil</h2>
        <p>Así te ven en asignaciones, historial y mensajes ({"{miembro}"}).</p>
        <form className="settings-form" onSubmit={(event) => { event.preventDefault(); onSaveProfile(name.trim(), initials.trim()); }}>
          <label>Nombre<input value={name} onChange={(event) => setName(event.target.value)} maxLength={60} required /></label>
          <label>Iniciales<input value={initials} onChange={(event) => setInitials(event.target.value.toUpperCase())} maxLength={3} required /></label>
          <label className="wide">Email<input value={me.email} disabled /></label>
          <button className="primary-button" type="submit" disabled={name.trim() === me.name && initials.trim() === me.initials}><Save size={15} /> Guardar perfil</button>
        </form>
        {/* En el celular la barra lateral no se ve: la sesión también se maneja desde acá. */}
        <div className="settings-actions">
          {canSwitchLocally
            ? team.filter((member) => member.email !== me.email).map((member) => <button key={member.email} className="secondary-button" type="button" onClick={() => onSwitchAccount(member.email)}><UserRoundCog size={15} /> Operar como {member.name}</button>)
            : <button className="secondary-button" type="button" onClick={() => onSwitchAccount()}><LogOut size={15} /> Cerrar sesión</button>}
        </div>
      </section>

      <section className="settings-card">
        <h2><Users size={16} /> Equipo</h2>
        <p>Sólo estas cuentas de Google pueden entrar. Para sumar a alguien, agregalo a <code>public.team_members</code> en Supabase.</p>
        <div className="operation-list">
          {team.map((member) => {
            const assigned = leads.filter((lead) => lead.assignedTo === member.email && !isTemporary(lead));
            return <article key={member.email}><Avatar member={member} /><div><strong>{member.name}{member.email === me.email ? " · vos" : ""}</strong><span>{member.email}</span></div><b>{assigned.length} PROSPECTOS</b></article>;
          })}
        </div>
      </section>

      <section className="settings-card wide">
        <h2>Mensajes y seguimiento</h2>
        <p>Variables disponibles: <code>{"{negocio}"}</code> <code>{"{observacion}"}</code> <code>{"{zona}"}</code> <code>{"{miembro}"}</code> <code>{"{firma}"}</code>. Evitá prometer resultados o criticar la web del negocio.</p>
        <div className="settings-form">
          <label>Días hasta volver a contactar<input type="number" min={1} max={60} value={draft.followUpDays} onChange={(event) => setDraft({ ...draft, followUpDays: Number(event.target.value) })} /></label>
          <label>Firma (email)<input value={draft.signature} onChange={(event) => setDraft({ ...draft, signature: event.target.value })} maxLength={200} /></label>
          {(Object.keys(templateLabel) as (keyof Templates)[]).map((key) => <label key={key} className="wide">{templateLabel[key]}<textarea rows={key === "email" ? 8 : 4} value={draft.templates[key]} onChange={(event) => setDraft({ ...draft, templates: { ...draft.templates, [key]: event.target.value } })} /></label>)}
          <div className="wide settings-actions">
            <button className="secondary-button" type="button" onClick={() => setDraft({ ...DEFAULT_SETTINGS, signature: draft.signature })}><RotateCcw size={15} /> Restaurar plantillas</button>
            <button className="primary-button" type="button" disabled={!dirty} onClick={() => onSaveSettings(draft)}><Save size={15} /> Guardar cambios</button>
          </div>
        </div>
      </section>

      <section className="settings-card">
        <h2>Servicios</h2>
        <p>Todo corre en planes gratuitos; si una fuente falta, la app se detiene en lugar de inventar datos.</p>
        <div className="operation-list">
          <article><Database size={19} /><div><strong>Supabase</strong><span>Acceso con Google + base compartida del equipo</span></div><ServiceState ok={services.supabase} /></article>
          <article><Radar size={19} /><div><strong>Tavily</strong><span>Búsqueda de prospectos · TAVILY_API_KEY</span></div><ServiceState ok={services.tavily} /></article>
          <article><ListChecks size={19} /><div><strong>Google PageSpeed</strong><span>Análisis de web más rico · GOOGLE_PAGESPEED_API_KEY (opcional)</span></div><ServiceState ok={services.pagespeed} /></article>
        </div>
      </section>

      <section className="settings-card">
        <h2>Respaldo</h2>
        <p>Descargá el CRM completo (sin la bandeja temporal) con notas, actividad y mensajes.</p>
        <button className="secondary-button" onClick={exportJson}><Download size={15} /> Exportar JSON</button>
      </section>
    </div>
  </>;
}

function ServiceState({ ok }: { ok: boolean }) {
  return ok ? <b className="service ok"><CheckCircle2 size={13} /> ACTIVO</b> : <b className="service off"><CircleAlert size={13} /> PENDIENTE</b>;
}
