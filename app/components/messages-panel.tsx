import { AlertTriangle, AtSign, Check, Copy, ExternalLink, Instagram, MessageCircle, Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { channelLabel, formatDateTime, memberName, PIPELINE_STAGES, relativeDue, renderTemplate, whatsappLinks, type Channel, type Lead, type WhatsappLink } from "@/lib/crm";
import { Avatar, StageBadge, type PanelProps } from "@/app/components/ui";

const channelIcon: Record<Channel, typeof MessageCircle> = { whatsapp: MessageCircle, email: AtSign, instagram: Instagram };
type Queue = "pendientes" | "primer" | "seguimiento";

export function MessagesPanel({ leads, team, me, now, settings, onOpen, onUpdate, composeId, onComposeChange }: PanelProps & { composeId?: string; onComposeChange: (id?: string) => void }) {
  const [queue, setQueue] = useState<Queue>("pendientes");
  const [channel, setChannel] = useState<Channel>("whatsapp");
  const [body, setBody] = useState("");
  const [historyOwner, setHistoryOwner] = useState<string>("todos");
  const [sending, setSending] = useState(false);

  const mine = leads.filter((lead) => lead.assignedTo === me.email || (!lead.assignedTo && lead.state === "guardado"));
  const firstContact = mine.filter((lead) => lead.state === "guardado");
  const followUps = mine.filter((lead) => lead.state === "contactado" && lead.nextFollowUpAt && Date.parse(lead.nextFollowUpAt) <= now + 24 * 60 * 60 * 1000);
  const list = queue === "primer" ? firstContact : queue === "seguimiento" ? followUps : [...followUps, ...firstContact];
  const selected = leads.find((lead) => lead.id === composeId) ?? list[0];
  const isFollowUp = Boolean(selected?.messages.length);

  const defaultChannel = (lead: Lead): Channel => lead.phone ? "whatsapp" : lead.email ? "email" : lead.instagramUrl ? "instagram" : "whatsapp";
  useEffect(() => { if (selected) setChannel(defaultChannel(selected)); }, [selected?.id]);
  useEffect(() => {
    if (!selected) { setBody(""); return; }
    setBody(renderTemplate(isFollowUp ? settings.templates.seguimiento : settings.templates[channel], selected, me, settings));
  }, [selected?.id, channel, isFollowUp, settings, me]);

  const history = useMemo(() => leads.flatMap((lead) => lead.messages.map((message) => ({ ...message, lead }))).filter((item) => historyOwner === "todos" || item.actor === historyOwner).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 40), [leads, historyOwner]);

  const whatsapp = selected && channel === "whatsapp" ? whatsappLinks(selected.phone, body) : undefined;
  const channelLinks: WhatsappLink[] = !selected ? []
    : whatsapp ? whatsapp.links
    : channel === "email" ? (selected.email ? [{ label: "Abrir email", url: `mailto:${selected.email}?subject=${encodeURIComponent(`${selected.name} · Upcoded`)}&body=${encodeURIComponent(body)}` }] : [])
    : selected.instagramUrl ? [{ label: "Abrir Instagram", url: selected.instagramUrl }] : [];
  const missingChannel = whatsapp?.problem ?? (channel === "email" ? "Cargá un email en la ficha para abrir el correo." : "No hay Instagram verificado para este prospecto.");

  async function register() {
    if (!selected || !body.trim()) return;
    setSending(true);
    const ok = await onUpdate(selected.id, { contact: { channel, body } }, `Contacto registrado. Seguimiento programado en ${settings.followUpDays} días.`);
    setSending(false);
    if (ok) onComposeChange(undefined);
  }

  return <>
    <div className="page-heading"><div><h1>Mensajes.</h1><p className="lede">Tu cola de contacto: primero los seguimientos vencidos, después los primeros contactos. Elegí canal, ajustá el texto, envialo desde tu WhatsApp o correo y registralo acá para que el equipo sepa quién habló con quién.</p></div></div>

    <div className="messages-layout">
      <section className="queue" aria-label="Cola de contacto">
        <div className="segmented small" role="tablist">
          {([["pendientes", "Todo", followUps.length + firstContact.length], ["seguimiento", "Seguimientos", followUps.length], ["primer", "Primer contacto", firstContact.length]] as const).map(([value, label, count]) => <button key={value} role="tab" aria-selected={queue === value} className={queue === value ? "active" : ""} onClick={() => setQueue(value)}>{label} <b>{count}</b></button>)}
        </div>
        <div className="queue-list">
          {selected && !list.some((lead) => lead.id === selected.id) && <QueueItem lead={selected} active onSelect={() => undefined} now={now} />}
          {list.map((lead) => <QueueItem key={lead.id} lead={lead} active={lead.id === selected?.id} onSelect={() => onComposeChange(lead.id)} now={now} />)}
          {!list.length && !selected && <div className="operation-empty"><Check size={22} /><strong>Cola vacía.</strong><span>Guardá prospectos en el CRM o esperá a que venza un seguimiento.</span></div>}
        </div>
      </section>

      <section className="composer" aria-label="Redactor">
        {selected ? <>
          <div className="composer-head">
            <div><button className="link-button" onClick={() => onOpen(selected.id)}>{selected.name}</button><span>{selected.category} · {selected.province || selected.location}</span></div>
            <StageBadge stage={selected.state} />
          </div>
          {selected.confidence < 75 && <p className="warning"><AlertTriangle size={15} /> Confianza {selected.confidence}%: verificá la identidad del negocio antes de escribirle.</p>}
          {selected.assignedTo && selected.assignedTo !== me.email && <p className="warning"><AlertTriangle size={15} /> Este prospecto lo lleva {memberName(team, selected.assignedTo)}. Coordiná antes de contactarlo.</p>}
          <div className="channel-tabs" role="tablist" aria-label="Canal">
            {(Object.keys(channelLabel) as Channel[]).map((value) => { const Icon = channelIcon[value]; return <button key={value} role="tab" aria-selected={channel === value} className={channel === value ? "active" : ""} onClick={() => setChannel(value)}><Icon size={15} /> {channelLabel[value]}</button>; })}
          </div>
          <label className="composer-label">{isFollowUp ? `Seguimiento (ya hubo ${selected.messages.length} mensaje${selected.messages.length === 1 ? "" : "s"})` : "Primer contacto"}
            <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={channel === "email" ? 11 : 7} />
          </label>
          <div className="composer-actions">
            <button className="secondary-button" onClick={() => navigator.clipboard?.writeText(body)}><Copy size={15} /> Copiar</button>
            {channelLinks.length ? channelLinks.map((item) => <a key={item.url} className="secondary-button" href={item.url} target="_blank" rel="noreferrer"><ExternalLink size={15} /> {item.label.startsWith("WhatsApp") ? `Abrir ${item.label}` : item.label}</a>) : <span className="cell-muted">{missingChannel}</span>}
            <button className="primary-button" onClick={register} disabled={sending || !body.trim()}><Send size={15} /> {sending ? "Registrando…" : "Registrar envío"}</button>
          </div>
          <small className="expiry">Al registrar: pasa a Contactado, queda a nombre de {me.name} y se programa el seguimiento en {settings.followUpDays} días. Nada se envía automáticamente.</small>
        </> : <div className="operation-empty"><Send size={22} /><strong>Elegí un prospecto.</strong><span>O abrí una ficha desde el CRM y usá “Escribir primer mensaje”.</span></div>}
      </section>
    </div>

    <section className="results-section">
      <div className="results-heading"><div><h2>Historial de mensajes</h2><p>Lo que registró cada miembro, del más reciente al más antiguo.</p></div>
        <div className="segmented small" role="tablist">{[{ id: "todos", label: "Equipo" }, ...team.map((member) => ({ id: member.email, label: member.name }))].map((option) => <button key={option.id} role="tab" aria-selected={historyOwner === option.id} className={historyOwner === option.id ? "active" : ""} onClick={() => setHistoryOwner(option.id)}>{option.label}</button>)}</div>
      </div>
      <div className="operation-list">
        {history.length ? history.map((item) => <article key={item.id} className="history-item">
          <Avatar member={team.find((member) => member.email === item.actor)} size="sm" />
          <div><button className="link-button" onClick={() => onOpen(item.lead.id)}>{item.lead.name}</button><span>{channelLabel[item.channel as Channel] ?? item.channel} · {memberName(team, item.actor)} · {formatDateTime(item.at)}</span><p>{item.body}</p></div>
          {PIPELINE_STAGES.includes(item.lead.state) && <StageBadge stage={item.lead.state} />}
        </article>) : <div className="operation-empty"><AtSign size={22} /><strong>Todavía no hay mensajes registrados.</strong></div>}
      </div>
    </section>
  </>;
}

function QueueItem({ lead, active, onSelect, now }: { lead: Lead; active: boolean; onSelect: () => void; now: number }) {
  const due = lead.state === "contactado" && lead.nextFollowUpAt ? `Seguimiento ${relativeDue(lead.nextFollowUpAt, now)}` : lead.state === "guardado" ? "Primer contacto" : "";
  return <button className={active ? "queue-item active" : "queue-item"} onClick={onSelect} aria-current={active}>
    <strong>{lead.name}</strong>
    <small>{lead.category} · {lead.province || lead.location}</small>
    <span>{due}{lead.phone ? " · tel" : ""}{lead.email ? " · email" : ""}</span>
  </button>;
}
