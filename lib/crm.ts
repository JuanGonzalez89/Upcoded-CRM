export type Stage = "nuevo" | "revisar" | "descartado" | "guardado" | "contactado" | "respondio" | "reunion" | "cliente" | "perdido" | "no_contactar";
export type Channel = "whatsapp" | "email" | "instagram";
export type WebStatus = "No localizada" | "Revisión manual" | "Con fricción" | "Web detectada";

export type TeamMember = { email: string; name: string; initials: string };
export type Activity = { id: string; kind: string; body: string; actor: string; at: string };
export type SentMessage = { id: string; channel: string; body: string; actor: string; at: string };

export type Lead = {
  id: string;
  name: string;
  category: string;
  province: string;
  locality: string;
  location: string;
  state: Stage;
  score: number;
  confidence: number;
  site: WebStatus;
  signals: string[];
  evidence: { label: string; url?: string }[];
  sourceUrl?: string;
  websiteUrl?: string;
  instagramUrl?: string;
  phone: string;
  email: string;
  notes: string;
  assignedTo?: string;
  lastContactedAt?: string;
  lastContactedBy?: string;
  nextFollowUpAt?: string;
  expiresAt?: number;
  createdAt: string;
  activity: Activity[];
  messages: SentMessage[];
};

export type LeadPatch = {
  state?: Stage;
  assignedTo?: string | null;
  notes?: string;
  phone?: string;
  email?: string;
  nextFollowUpAt?: string | null;
  note?: string;
  contact?: { channel: Channel; body: string };
};

export type Templates = Record<Channel | "seguimiento", string>;
export type Settings = { followUpDays: number; signature: string; templates: Templates };

export const TEMPORARY_STAGES: Stage[] = ["nuevo", "revisar", "descartado"];
export const PIPELINE_STAGES: Stage[] = ["guardado", "contactado", "respondio", "reunion", "cliente", "perdido", "no_contactar"];

export const stageLabel: Record<Stage, string> = {
  nuevo: "Nuevo",
  revisar: "Revisar",
  descartado: "Descartado",
  guardado: "Por contactar",
  contactado: "Contactado",
  respondio: "Respondió",
  reunion: "Reunión",
  cliente: "Cliente",
  perdido: "Perdido",
  no_contactar: "No contactar",
};

export const stageTone: Record<Stage, string> = {
  nuevo: "new", revisar: "review", descartado: "muted", guardado: "new", contactado: "review",
  respondio: "saved", reunion: "saved", cliente: "saved", perdido: "muted", no_contactar: "muted",
};

export const channelLabel: Record<Channel, string> = { whatsapp: "WhatsApp", email: "Email", instagram: "Instagram" };

export const DEFAULT_TEAM: TeamMember[] = [
  { email: "juanignaciogonzalez.ca@gmail.com", name: "Juan Ignacio", initials: "JI" },
  { email: "jpgarciamallorquin@gmail.com", name: "JP García", initials: "JP" },
];

export const DEFAULT_SETTINGS: Settings = {
  followUpDays: 4,
  signature: "Equipo Upcoded · upcoded.dev",
  templates: {
    whatsapp: "Hola, ¿cómo están? Soy {miembro}, de Upcoded. Estuve mirando {negocio} y noté que {observacion}. Hacemos sitios rápidos y claros para negocios de {zona}, con alcance y precio cerrados desde el inicio. ¿Les sirve que les pase dos o tres ideas concretas?",
    email: "Hola, equipo de {negocio}:\n\nSoy {miembro}, de Upcoded. Revisando su presencia online noté que {observacion}.\n\nTrabajamos directo con los dueños de cada negocio: entregamos en semanas, con alcance y precio claros desde el primer día.\n\n¿Les interesa que les comparta un par de mejoras puntuales para su caso?\n\n{firma}",
    instagram: "¡Hola! Soy {miembro}, de Upcoded. Vimos {negocio} y notamos que {observacion}. Armamos webs rápidas para negocios de {zona}. ¿Les puedo pasar un par de ideas por acá?",
    seguimiento: "Hola, ¿cómo están? Les escribí hace unos días desde Upcoded sobre {negocio}. Quería saber si pudieron verlo; si no es el momento, no hay problema. ¿Les sirve que lo retomemos más adelante?",
  },
};

export function memberName(team: TeamMember[], email?: string | null) {
  if (!email) return "Sin asignar";
  return team.find((member) => member.email === email)?.name ?? email;
}

export function isTemporary(lead: Lead) {
  return TEMPORARY_STAGES.includes(lead.state);
}

// Sólo los hallazgos verificados de la auditoría se convierten en observaciones para el cliente;
// las notas internas del buscador ("revisión manual", "no se localizó…") nunca llegan al mensaje.
const OUTREACH_OBSERVATIONS: [RegExp, string][] = [
  // Sólo errores que un visitante también vería; un 403/429 suele ser bloqueo al bot de auditoría.
  [/respondió con estado (404|410|5\d\d)\b/i, "la web está dando error al abrirla"],
  [/formulario ni canal|Contacto poco visible|Sin llamada a la acción/i, "no hay una forma rápida de consultar desde la web, como un formulario o WhatsApp"],
  [/viewport/i, "la web no se adapta bien al celular"],
  [/Respuesta lenta|lento en móvil/i, "la web tarda bastante en cargar"],
  [/no usa HTTPS/i, "el sitio todavía no usa conexión segura (HTTPS)"],
  [/Título SEO|Meta descripción/i, "el sitio no tiene título ni descripción claros para aparecer en Google"],
];
const FALLBACK_OBSERVATION = "hay margen para que las consultas les lleguen más fácil";

export function outreachObservation(lead: Lead) {
  return OUTREACH_OBSERVATIONS.find(([pattern]) => lead.signals.some((signal) => pattern.test(signal)))?.[1] ?? FALLBACK_OBSERVATION;
}

export function renderTemplate(template: string, lead: Lead, member: TeamMember | undefined, settings: Settings) {
  const values: Record<string, string> = {
    negocio: lead.name,
    observacion: outreachObservation(lead),
    zona: lead.locality || lead.province || "la zona",
    miembro: member?.name ?? "el equipo",
    firma: settings.signature,
  };
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

export type WhatsappLink = { label: string; url: string };

/**
 * Links de WhatsApp para un teléfono. En Argentina los celulares van como 549 + área + número
 * (sin 0 ni 15) y los fijos de WhatsApp Business como 54 + área + número. Si no se puede saber
 * cuál es, se ofrecen los dos. Devuelve un problema legible cuando el número no sirve.
 */
export function whatsappLinks(phone: string, text: string): { links: WhatsappLink[]; problem?: string } {
  const raw = phone.trim();
  if (!raw) return { links: [], problem: "Cargá un teléfono en la ficha para abrir WhatsApp." };
  if (/[/,;]|\b(int|interno|ext)\b/i.test(raw)) return { links: [], problem: "El teléfono tiene más de un número o un interno: dejá uno solo en la ficha." };
  const link = (number: string) => `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
  let digits = raw.replace(/\D/g, "");
  const international = raw.startsWith("+") || digits.startsWith("00");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (international && !digits.startsWith("54")) {
    return digits.length >= 8 && digits.length <= 15 ? { links: [{ label: "WhatsApp", url: link(digits) }] } : { links: [], problem: "El número internacional parece incompleto." };
  }
  let mobile = false;
  if (digits.startsWith("54")) {
    digits = digits.slice(2);
    if (digits.startsWith("9")) { mobile = true; digits = digits.slice(1); }
  }
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (/^(800|810|600)/.test(digits)) return { links: [], problem: "Es un número 0800/0810: no tiene WhatsApp." };
  if (digits.length === 12) {
    // Área de 2 a 4 dígitos seguida del prefijo móvil 15.
    const split = [2, 3, 4].find((size) => digits.slice(size, size + 2) === "15");
    if (split) { mobile = true; digits = digits.slice(0, split) + digits.slice(split + 2); }
  }
  // Las áreas argentinas empiezan con 11, 2 o 3 y el número nacional tiene 10 dígitos.
  if (digits.length !== 10 || !/^(11|2|3)/.test(digits)) return { links: [], problem: "Al teléfono le falta el código de área o tiene dígitos de más: revisalo en la ficha." };
  if (mobile) return { links: [{ label: "WhatsApp", url: link(`549${digits}`) }] };
  return { links: [{ label: "WhatsApp (celular)", url: link(`549${digits}`) }, { label: "WhatsApp (fijo)", url: link(`54${digits}`) }] };
}

export function addDays(days: number, from = Date.now()) {
  return new Date(from + days * 24 * 60 * 60 * 1000).toISOString();
}

export function formatDate(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

export function formatDateTime(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function formatRemaining(ms: number) {
  if (ms <= 0) return "vencido";
  const totalMinutes = Math.ceil(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours} h ${String(minutes).padStart(2, "0")} min`;
}

export function relativeDue(value: string | undefined, now: number) {
  if (!value) return "";
  const days = Math.round((Date.parse(value) - now) / (24 * 60 * 60 * 1000));
  if (days === 0) return "hoy";
  if (days < 0) return `hace ${-days} d`;
  return `en ${days} d`;
}

export type TicketKind = "seguimiento" | "respondio" | "por_contactar" | "sin_asignar" | "reunion" | "por_vencer";
export type Ticket = { id: string; kind: TicketKind; lead: Lead; title: string; detail: string; due: string; priority: 1 | 2 | 3 };

export const ticketLabel: Record<TicketKind, string> = {
  seguimiento: "Volver a contactar",
  respondio: "Respondió",
  por_contactar: "Por contactar",
  sin_asignar: "Sin asignar",
  reunion: "Reunión",
  por_vencer: "Por vencer",
};

/** Arma la bandeja de pendientes de un miembro (o de todo el equipo si scope es "equipo"). */
export function buildTickets(leads: Lead[], me: string, scope: "mios" | "equipo", now: number): Ticket[] {
  const mine = (lead: Lead) => scope === "equipo" || lead.assignedTo === me;
  const tickets: Ticket[] = [];
  for (const lead of leads) {
    const followUp = lead.nextFollowUpAt ? Date.parse(lead.nextFollowUpAt) : undefined;
    if (lead.state === "respondio" && mine(lead)) {
      tickets.push({ id: `${lead.id}-r`, kind: "respondio", lead, priority: 1, title: "Respondió: falta contestarle", detail: lead.lastContactedAt ? `Último contacto ${formatDate(lead.lastContactedAt)}` : "Registrá la próxima acción", due: relativeDue(lead.nextFollowUpAt, now) || "ahora" });
    } else if (lead.state === "contactado" && mine(lead) && followUp !== undefined && followUp <= now + 12 * 60 * 60 * 1000) {
      tickets.push({ id: `${lead.id}-s`, kind: "seguimiento", lead, priority: followUp < now ? 1 : 2, title: "Sin respuesta: volver a contactar", detail: `Contactado ${formatDate(lead.lastContactedAt)} · ${lead.messages.length} mensaje${lead.messages.length === 1 ? "" : "s"}`, due: relativeDue(lead.nextFollowUpAt, now) });
    } else if (lead.state === "reunion" && mine(lead)) {
      tickets.push({ id: `${lead.id}-m`, kind: "reunion", lead, priority: 2, title: "Reunión en curso", detail: lead.notes ? lead.notes.slice(0, 80) : "Definí la propuesta o el próximo paso", due: relativeDue(lead.nextFollowUpAt, now) || "—" });
    } else if (lead.state === "guardado" && !lead.assignedTo) {
      tickets.push({ id: `${lead.id}-u`, kind: "sin_asignar", lead, priority: 2, title: "Guardado sin responsable", detail: "Asignalo para que no quede en el medio", due: "—" });
    } else if (lead.state === "guardado" && mine(lead)) {
      tickets.push({ id: `${lead.id}-c`, kind: "por_contactar", lead, priority: lead.score >= 80 ? 2 : 3, title: "Primer contacto pendiente", detail: lead.phone || lead.email ? "Tiene canal de contacto cargado" : "Falta cargar teléfono o email", due: relativeDue(lead.nextFollowUpAt, now) || "—" });
    } else if (isTemporary(lead) && lead.state !== "descartado" && lead.expiresAt && lead.expiresAt - now < 6 * 60 * 60 * 1000 && lead.score >= 70) {
      tickets.push({ id: `${lead.id}-v`, kind: "por_vencer", lead, priority: 3, title: "Se elimina de la bandeja pronto", detail: `Oportunidad ${lead.score} · guardalo si vale la pena`, due: formatRemaining(lead.expiresAt - now) });
    }
  }
  return tickets.sort((a, b) => a.priority - b.priority || b.lead.score - a.lead.score);
}

/** Aplica un cambio en modo local, replicando lo que hace el servidor. */
export function applyLocalPatch(lead: Lead, patch: LeadPatch, actor: string, team: TeamMember[], settings: Settings): Lead {
  const now = new Date().toISOString();
  const next: Lead = { ...lead, activity: [...lead.activity], messages: [...lead.messages] };
  const log = (kind: string, body: string) => next.activity.unshift({ id: crypto.randomUUID(), kind, body, actor, at: now });
  if (patch.state && patch.state !== lead.state) {
    next.state = patch.state;
    if (!TEMPORARY_STAGES.includes(patch.state)) next.expiresAt = undefined;
    if (patch.state === "guardado" && !next.assignedTo && patch.assignedTo === undefined) next.assignedTo = actor;
    log("estado", `${stageLabel[lead.state]} → ${stageLabel[patch.state]}`);
  }
  if (patch.assignedTo !== undefined && patch.assignedTo !== lead.assignedTo) {
    next.assignedTo = patch.assignedTo ?? undefined;
    log("asignacion", `Asignado a ${memberName(team, patch.assignedTo)}`);
  }
  if (patch.notes !== undefined) next.notes = patch.notes;
  if (patch.phone !== undefined) next.phone = patch.phone;
  if (patch.email !== undefined) next.email = patch.email;
  if (patch.nextFollowUpAt !== undefined) {
    next.nextFollowUpAt = patch.nextFollowUpAt ?? undefined;
    log("seguimiento", patch.nextFollowUpAt ? `Seguimiento para el ${formatDate(patch.nextFollowUpAt)}` : "Seguimiento quitado");
  }
  if (patch.note) log("nota", patch.note);
  if (patch.contact) {
    next.messages.unshift({ id: crypto.randomUUID(), channel: patch.contact.channel, body: patch.contact.body, actor, at: now });
    next.lastContactedAt = now;
    next.lastContactedBy = actor;
    next.nextFollowUpAt = addDays(settings.followUpDays);
    if (!next.assignedTo) next.assignedTo = actor;
    if (["guardado", "nuevo", "revisar", "contactado"].includes(next.state)) next.state = "contactado";
    next.expiresAt = undefined;
    log("contacto", `Mensaje por ${channelLabel[patch.contact.channel]}`);
  }
  return next;
}
