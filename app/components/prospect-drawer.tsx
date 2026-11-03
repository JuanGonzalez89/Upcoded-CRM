import { AtSign, CalendarClock, Check, Globe2, Instagram, Link2, MessageSquareText, Phone, StickyNote, X } from "lucide-react";
import { useEffect, useState } from "react";
import { channelLabel, formatDateTime, isTemporary, memberName, PIPELINE_STAGES, stageLabel, TEMPORARY_STAGES, type Channel, type Lead, type Stage } from "@/lib/crm";
import { AssigneeSelect, Avatar, StageBadge, type PanelProps } from "@/app/components/ui";

const kindLabel: Record<string, string> = { estado: "Etapa", asignacion: "Responsable", nota: "Nota", contacto: "Contacto", seguimiento: "Seguimiento", datos: "Datos" };

function toDateInput(value?: string) {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

export function ProspectDrawer({ lead, team, onUpdate, onCompose, onClose }: PanelProps & { lead: Lead; onClose: () => void }) {
  const [phone, setPhone] = useState(lead.phone);
  const [email, setEmail] = useState(lead.email);
  const [notes, setNotes] = useState(lead.notes);
  const [note, setNote] = useState("");

  // Sólo al abrir una ficha distinta: si dependiera de phone/email/notes, un cambio de fondo del
  // mismo lead (sync con el equipo, reintento fallido) pisaría lo que la persona está escribiendo.
  useEffect(() => { setPhone(lead.phone); setEmail(lead.email); setNotes(lead.notes); }, [lead.id]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const stages: Stage[] = isTemporary(lead) ? [...TEMPORARY_STAGES, ...PIPELINE_STAGES] : PIPELINE_STAGES;
  const timeline = [
    ...lead.activity.map((item) => ({ ...item, label: kindLabel[item.kind] ?? item.kind, message: undefined as string | undefined })),
    ...lead.messages.map((item) => ({ id: item.id, kind: "mensaje", body: `Mensaje por ${channelLabel[item.channel as Channel] ?? item.channel}`, actor: item.actor, at: item.at, label: "Mensaje", message: item.body })),
  ].sort((a, b) => b.at.localeCompare(a.at)).filter((item, index, all) => !(item.kind === "contacto" && all.some((other) => other.kind === "mensaje" && Math.abs(Date.parse(other.at) - Date.parse(item.at)) < 5000)));

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title" onClick={(event) => event.stopPropagation()}>
        <header className="drawer-head">
          <div><StageBadge stage={lead.state} /><h2 id="drawer-title">{lead.name}</h2><p>{lead.category} · {lead.location || lead.province}</p></div>
          <button className="icon-button" onClick={onClose} aria-label="Cerrar ficha"><X size={17} /></button>
        </header>

        <div className="drawer-body">
          <section className="drawer-grid">
            <label>Etapa<select className="inline-select" value={lead.state} onChange={(event) => onUpdate(lead.id, { state: event.target.value as Stage }, `Etapa: ${stageLabel[event.target.value as Stage]}.`)}>{stages.map((value) => <option key={value} value={value}>{stageLabel[value]}</option>)}</select></label>
            <label>Responsable<AssigneeSelect lead={lead} team={team} onUpdate={onUpdate} /></label>
            <label>Próximo seguimiento<input type="date" className="inline-select" value={toDateInput(lead.nextFollowUpAt)} onChange={(event) => onUpdate(lead.id, { nextFollowUpAt: event.target.value ? new Date(`${event.target.value}T12:00:00`).toISOString() : null })} /></label>
            <div className="drawer-stat"><span>Último contacto</span><strong>{lead.lastContactedAt ? formatDateTime(lead.lastContactedAt) : "Nunca"}</strong><small>{lead.lastContactedBy ? `por ${memberName(team, lead.lastContactedBy)}` : ""}</small></div>
          </section>

          <section className="drawer-section">
            <h3>Contacto</h3>
            <div className="contact-fields">
              <label><Phone size={14} /><input value={phone} onChange={(event) => setPhone(event.target.value)} onBlur={() => phone !== lead.phone && onUpdate(lead.id, { phone }, "Teléfono guardado.")} placeholder="Teléfono o WhatsApp" aria-label="Teléfono" /></label>
              <label><AtSign size={14} /><input value={email} onChange={(event) => setEmail(event.target.value)} onBlur={() => email !== lead.email && onUpdate(lead.id, { email }, "Email guardado.")} placeholder="Email" type="email" aria-label="Email" /></label>
            </div>
            <div className="link-list">
              {lead.websiteUrl && <a href={lead.websiteUrl} target="_blank" rel="noreferrer"><Globe2 size={14} /> {new URL(lead.websiteUrl).hostname}</a>}
              {lead.instagramUrl && <a href={lead.instagramUrl} target="_blank" rel="noreferrer"><Instagram size={14} /> Instagram</a>}
              {lead.sourceUrl && lead.sourceUrl !== lead.websiteUrl && <a href={lead.sourceUrl} target="_blank" rel="noreferrer"><Link2 size={14} /> Fuente original</a>}
              {!lead.websiteUrl && !lead.instagramUrl && !lead.sourceUrl && <span className="cell-muted">Sin enlaces verificados.</span>}
            </div>
            <button className="primary-button" onClick={() => onCompose(lead.id)}><MessageSquareText size={15} /> {lead.messages.length ? "Escribir seguimiento" : "Escribir primer mensaje"}</button>
          </section>

          <section className="drawer-section">
            <h3>Diagnóstico</h3>
            <div className="score-split"><div><span>Oportunidad</span><strong>{lead.score}</strong><small>/ 100</small></div><div><span>Confianza</span><strong>{lead.confidence}%</strong><small>{lead.site}</small></div></div>
            <div className="evidence">{lead.signals.map((signal) => <p key={signal}><Check size={15} /> {signal}</p>)}</div>
            {lead.evidence.length > 0 && <ul className="evidence-list">{lead.evidence.map((item, index) => <li key={index}>{item.url ? <a href={item.url} target="_blank" rel="noreferrer">{item.label}</a> : item.label}</li>)}</ul>}
          </section>

          <section className="drawer-section">
            <h3>Notas del prospecto</h3>
            <textarea className="notes" value={notes} onChange={(event) => setNotes(event.target.value)} onBlur={() => notes !== lead.notes && onUpdate(lead.id, { notes }, "Notas guardadas.")} placeholder="Quién atiende, horarios, qué les interesa, objeciones…" rows={4} />
          </section>

          <section className="drawer-section">
            <h3>Actividad</h3>
            <form className="note-form" onSubmit={(event) => { event.preventDefault(); if (!note.trim()) return; onUpdate(lead.id, { note }, "Nota agregada al historial."); setNote(""); }}>
              <StickyNote size={14} /><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Registrar llamada, respuesta o comentario…" aria-label="Nueva nota" /><button className="secondary-button" type="submit" disabled={!note.trim()}>Agregar</button>
            </form>
            <ol className="timeline">
              {timeline.length ? timeline.map((item) => <li key={item.id}>
                <Avatar member={team.find((member) => member.email === item.actor)} size="sm" />
                <div><span><b>{item.label}</b> · {memberName(team, item.actor)} · {formatDateTime(item.at)}</span><p>{item.body}</p>{item.message && <blockquote>{item.message}</blockquote>}</div>
              </li>) : <li className="cell-muted"><CalendarClock size={14} /> Sin actividad todavía.</li>}
            </ol>
          </section>
        </div>
      </aside>
    </div>
  );
}
