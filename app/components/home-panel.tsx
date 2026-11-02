import { ArrowRight, CircleOff, CalendarClock, Check, Clock3, Inbox, MessageSquareReply, PhoneOutgoing, UserPlus, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { buildTickets, isTemporary, memberName, ticketLabel, type TicketKind } from "@/lib/crm";
import { Avatar, type PanelProps, type Section } from "@/app/components/ui";

const ticketIcon: Record<TicketKind, typeof Inbox> = {
  sin_respuesta: CircleOff,
  seguimiento: CalendarClock, respondio: MessageSquareReply, por_contactar: PhoneOutgoing, sin_asignar: UserPlus, reunion: Users, por_vencer: Clock3,
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function HomePanel({ leads, team, me, now, onOpen, onUpdate, onCompose, onNavigate }: PanelProps & { onNavigate: (section: Section) => void }) {
  const [scope, setScope] = useState<"mios" | "equipo">("mios");
  const [kind, setKind] = useState<TicketKind | "todos">("todos");
  const tickets = useMemo(() => buildTickets(leads, me.email, scope, now), [leads, me.email, scope, now]);
  const visible = kind === "todos" ? tickets : tickets.filter((ticket) => ticket.kind === kind);
  const counts = tickets.reduce<Partial<Record<TicketKind, number>>>((acc, ticket) => ({ ...acc, [ticket.kind]: (acc[ticket.kind] ?? 0) + 1 }), {});

  const weekly = team.map((member) => {
    const sent = leads.flatMap((lead) => lead.messages).filter((message) => message.actor === member.email && now - Date.parse(message.at) < WEEK_MS).length;
    const assigned = leads.filter((lead) => lead.assignedTo === member.email && !isTemporary(lead) && !["perdido", "no_contactar"].includes(lead.state));
    return { member, sent, active: assigned.length, replied: assigned.filter((lead) => ["respondio", "reunion"].includes(lead.state)).length, clients: assigned.filter((lead) => lead.state === "cliente").length };
  });
  const bandeja = leads.filter((lead) => isTemporary(lead) && lead.state !== "descartado").length;

  return (
    <div className="home">
      <div className="page-heading">
        <div><h1>Hola, {me.name}.</h1><p className="lede">{tickets.length ? `Tenés ${tickets.length} pendiente${tickets.length === 1 ? "" : "s"} ${scope === "mios" ? "asignados a vos" : "en el equipo"}. Empezá por los de arriba: están ordenados por urgencia.` : "No hay pendientes. Buen momento para lanzar una búsqueda nueva."}</p></div>
        <div className="segmented" role="tablist" aria-label="Alcance">
          <button role="tab" aria-selected={scope === "mios"} className={scope === "mios" ? "active" : ""} onClick={() => setScope("mios")}>Mis pendientes</button>
          <button role="tab" aria-selected={scope === "equipo"} className={scope === "equipo" ? "active" : ""} onClick={() => setScope("equipo")}>Todo el equipo</button>
        </div>
      </div>

      <section className="team-strip" aria-label="Actividad de los últimos 7 días">
        {weekly.map(({ member, sent, active, replied, clients }) => (
          <article key={member.email} className={member.email === me.email ? "me" : ""}>
            <Avatar member={member} />
            <div><strong>{member.name}{member.email === me.email && <small> · vos</small>}</strong><span>Últimos 7 días</span></div>
            <dl><div><dt>Contactos</dt><dd>{sent}</dd></div><div><dt>Activos</dt><dd>{active}</dd></div><div><dt>Respondieron</dt><dd>{replied}</dd></div><div><dt>Clientes</dt><dd>{clients}</dd></div></dl>
          </article>
        ))}
        <article className="bandeja-card">
          <Inbox size={20} />
          <div><strong>{bandeja} en bandeja temporal</strong><span>Sin revisar; vencen en 24 h</span></div>
          <button className="secondary-button" onClick={() => onNavigate("Prospección")}>Revisar <ArrowRight size={14} /></button>
        </article>
      </section>

      <section className="tickets">
        <div className="ticket-filters" role="tablist" aria-label="Tipo de pendiente">
          <button role="tab" aria-selected={kind === "todos"} className={kind === "todos" ? "active" : ""} onClick={() => setKind("todos")}>Todos <b>{tickets.length}</b></button>
          {(Object.keys(ticketLabel) as TicketKind[]).filter((key) => counts[key]).map((key) => <button key={key} role="tab" aria-selected={kind === key} className={kind === key ? "active" : ""} onClick={() => setKind(key)}>{ticketLabel[key]} <b>{counts[key]}</b></button>)}
        </div>
        <div className="ticket-list">
          {visible.length ? visible.map((ticket) => {
            const Icon = ticketIcon[ticket.kind];
            const owner = team.find((member) => member.email === ticket.lead.assignedTo);
            return (
              <article key={ticket.id} className={`ticket p${ticket.priority}`}>
                <span className={`ticket-icon k-${ticket.kind}`}><Icon size={17} /></span>
                <button className="ticket-main" onClick={() => onOpen(ticket.lead.id)}>
                  <span className="ticket-kind">{ticketLabel[ticket.kind]}{ticket.priority === 1 && <i>Urgente</i>}</span>
                  <strong>{ticket.lead.name}</strong>
                  <small>{ticket.title} · {ticket.detail}</small>
                  <small className="ticket-meta">{ticket.lead.category} · {ticket.lead.province || ticket.lead.location}</small>
                </button>
                <span className="ticket-due">{ticket.due}</span>
                <span className="ticket-owner" title={memberName(team, ticket.lead.assignedTo)}><Avatar member={owner} size="sm" /></span>
                <span className="ticket-actions">
                  {ticket.kind === "sin_asignar" && <button className="secondary-button" onClick={() => onUpdate(ticket.lead.id, { assignedTo: me.email }, `${ticket.lead.name} quedó asignado a vos.`)}><UserPlus size={14} /> Tomarlo</button>}
                  {(ticket.kind === "por_contactar" || ticket.kind === "seguimiento") && <button className="primary-button" onClick={() => onCompose(ticket.lead.id)}><PhoneOutgoing size={14} /> {ticket.kind === "seguimiento" ? "Recontactar" : "Contactar"}</button>}
                  {ticket.kind === "sin_respuesta" && <><button className="secondary-button" onClick={() => onCompose(ticket.lead.id)}><PhoneOutgoing size={14} /> Un intento más</button><button className="secondary-button" onClick={() => onUpdate(ticket.lead.id, { state: "perdido" }, `${ticket.lead.name} pasó a Perdido.`)}><CircleOff size={14} /> Pasar a Perdido</button></>}
                  {ticket.kind === "respondio" && <button className="secondary-button" onClick={() => onUpdate(ticket.lead.id, { state: "reunion" }, "Pasó a Reunión.")}><Check size={14} /> Agendé reunión</button>}
                  {ticket.kind === "por_vencer" && <button className="secondary-button" onClick={() => onUpdate(ticket.lead.id, { state: "guardado" }, "Guardado en el CRM.")}><Check size={14} /> Guardar</button>}
                </span>
              </article>
            );
          }) : <div className="operation-empty"><Check size={24} /><strong>Nada pendiente acá.</strong><span>Cuando guardes prospectos, contactes a alguien o se cumpla un seguimiento, va a aparecer en esta bandeja.</span></div>}
        </div>
      </section>
    </div>
  );
}
