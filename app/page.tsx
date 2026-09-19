"use client";

import {
  ArrowUpRight,
  Bell,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Copy,
  Globe2,
  KanbanSquare,
  LayoutDashboard,
  MapPin,
  MessageSquareText,
  MoreHorizontal,
  PanelLeftClose,
  Plus,
  Radar,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { draftUpcodedMessage } from "@/lib/prospecting";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase-browser";
import { OperationsPanel } from "@/app/components/operations-panel";

type LeadState = "Nuevo" | "Revisar" | "Guardado";
type Lead = {
  id: string | number;
  name: string;
  category: string;
  location: string;
  state: LeadState;
  score: number;
  confidence: number;
  site: "No localizada" | "Revisión manual" | "Con fricción" | "Web detectada";
  signals: string[];
  sourceUrl?: string;
  expires: string;
  expiresAt?: number;
};

const initialLeads: Lead[] = [
  { id: 1, name: "Lumen Odontología · demo", category: "Consultorio odontológico", location: "Recoleta, CABA", state: "Nuevo", score: 91, confidence: 87, site: "No localizada", signals: ["No se encontró dominio verificable", "Instagram activo"], expires: "23 h 42 min" },
  { id: 2, name: "Casa Naranjo Eventos · demo", category: "Salón de eventos", location: "Palermo, CABA", state: "Revisar", score: 84, confidence: 62, site: "Revisión manual", signals: ["La bio de Instagram podría contener un enlace", "Sin web confirmada"], expires: "23 h 42 min" },
  { id: 3, name: "Estudio Río Propiedades · demo", category: "Inmobiliaria", location: "Vicente López, Buenos Aires", state: "Nuevo", score: 76, confidence: 89, site: "Con fricción", signals: ["Sitio lento en móvil", "Contacto poco visible"], expires: "23 h 42 min" },
  { id: 4, name: "Consultorios Norte · demo", category: "Centro médico", location: "Belgrano, CABA", state: "Nuevo", score: 72, confidence: 78, site: "Con fricción", signals: ["HTTPS correcto", "Sin llamada a la acción clara"], expires: "23 h 42 min" },
];

const nicheCatalog = [
  { name: "Consultorios odontológicos", opportunity: 92, reason: "Turnos, tratamientos de alto valor y necesidad de confianza antes del primer contacto." },
  { name: "Centros de estética y medicina estética", opportunity: 91, reason: "La decisión visual y la agenda online impactan directo en consultas." },
  { name: "Salones de eventos", opportunity: 89, reason: "Fotos, disponibilidad y consultas rápidas son clave para no perder fechas." },
  { name: "Inmobiliarias", opportunity: 88, reason: "Propiedades, captación de dueños y formularios convierten mejor con web propia." },
  { name: "Estudios jurídicos", opportunity: 86, reason: "La credibilidad y la especialización clara ayudan a generar consultas calificadas." },
  { name: "Kinesiología y fisioterapia", opportunity: 85, reason: "Turnos, especialidades y ubicación suelen estar dispersos entre redes y directorios." },
  { name: "Constructoras y arquitectura", opportunity: 84, reason: "Portfolio, casos y presupuestos necesitan una presentación de mayor confianza." },
  { name: "Veterinarias", opportunity: 83, reason: "Guardias, turnos y servicios frecuentes se benefician de información clara y local." },
  { name: "Gimnasios y estudios de entrenamiento", opportunity: 82, reason: "Horarios, clases de prueba y planes convierten mejor fuera de Instagram." },
  { name: "Institutos educativos", opportunity: 81, reason: "Inscripciones, cursos y consultas requieren información ordenada y encontrable." },
  { name: "Psicología y salud mental", opportunity: 80, reason: "Profesionalidad, especialidades y disponibilidad generan confianza inicial." },
  { name: "Restaurantes y cafeterías", opportunity: 78, reason: "Menú, reservas y ubicación pueden reducir dependencia de plataformas externas." },
  { name: "Talleres mecánicos", opportunity: 77, reason: "Servicios, turnos y reputación local suelen estar poco organizados digitalmente." },
  { name: "Mueblerías y decoración", opportunity: 76, reason: "El catálogo visual y las consultas por medida tienen alto potencial de mejora." },
  { name: "Contadores y estudios contables", opportunity: 75, reason: "La oferta de servicios y los canales de contacto suelen ser poco claros." },
  { name: "Clínicas y centros médicos", opportunity: 74, reason: "Tiene potencial alto, pero exige una revisión más estricta por regulación y confianza." },
] as const;

const provinces = ["Ciudad Autónoma de Buenos Aires", "Buenos Aires", "Catamarca", "Chaco", "Chubut", "Córdoba", "Corrientes", "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja", "Mendoza", "Misiones", "Neuquén", "Río Negro", "Salta", "San Juan", "San Luis", "Santa Cruz", "Santa Fe", "Santiago del Estero", "Tierra del Fuego", "Tucumán"];

const areasByProvince: Record<string, string[]> = {
  "Ciudad Autónoma de Buenos Aires": ["Recoleta", "Palermo", "Belgrano", "Caballito", "Villa Urquiza", "Núñez", "Almagro", "Microcentro"],
  "Buenos Aires": ["La Plata", "Vicente López", "San Isidro", "Tigre", "Quilmes", "Mar del Plata", "Bahía Blanca", "Lanús"],
  "Córdoba": ["Córdoba Capital", "Villa Carlos Paz", "Río Cuarto", "Nueva Córdoba", "General Paz"],
  "Santa Fe": ["Rosario", "Santa Fe Capital", "Rafaela", "Funes", "Venado Tuerto"],
  "Mendoza": ["Mendoza Capital", "Godoy Cruz", "Guaymallén", "Luján de Cuyo", "San Rafael"],
  "Tucumán": ["San Miguel de Tucumán", "Yerba Buena", "Tafí Viejo"],
  "Entre Ríos": ["Paraná", "Concordia", "Gualeguaychú"],
  "Salta": ["Salta Capital", "San Lorenzo", "Tartagal"],
  "Misiones": ["Posadas", "Oberá", "Puerto Iguazú"],
  "Neuquén": ["Neuquén Capital", "San Martín de los Andes", "Villa La Angostura"],
  "Río Negro": ["Bariloche", "Viedma", "General Roca"],
  "Chubut": ["Comodoro Rivadavia", "Puerto Madryn", "Trelew"],
  "San Juan": ["San Juan Capital", "Rivadavia", "Rawson"],
  "San Luis": ["San Luis Capital", "Villa Mercedes", "Merlo"],
  "Corrientes": ["Corrientes Capital", "Goya", "Paso de los Libres"],
  "Chaco": ["Resistencia", "Presidencia Roque Sáenz Peña"],
  "Formosa": ["Formosa Capital", "Clorinda"],
  "Jujuy": ["San Salvador de Jujuy", "Palpalá"],
  "La Pampa": ["Santa Rosa", "General Pico"],
  "La Rioja": ["La Rioja Capital", "Chilecito"],
  "Catamarca": ["San Fernando del Valle de Catamarca", "Belén"],
  "Santa Cruz": ["Río Gallegos", "Caleta Olivia", "El Calafate"],
  "Santiago del Estero": ["Santiago del Estero Capital", "La Banda"],
  "Tierra del Fuego": ["Ushuaia", "Río Grande", "Tolhuin"],
};

const nav = [
  { label: "Inicio", icon: LayoutDashboard },
  { label: "Prospección", icon: Radar },
  { label: "CRM", icon: KanbanSquare },
  { label: "Mensajes", icon: MessageSquareText },
  { label: "Configuración", icon: Settings2 },
];

const stateClass: Record<LeadState, string> = { Nuevo: "new", Revisar: "review", Guardado: "saved" };
const TEMPORARY_WINDOW_MS = 24 * 60 * 60 * 1000;

function formatRemaining(ms: number) {
  if (ms <= 0) return "vencido";
  const totalMinutes = Math.ceil(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours} h ${String(minutes).padStart(2, "0")} min`;
}

export default function Home() {
  const [section, setSection] = useState("Prospección");
  const [leads, setLeads] = useState(initialLeads);
  const [activeId, setActiveId] = useState<string | number>(1);
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [sidebar, setSidebar] = useState(true);
  const [notice, setNotice] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [hydrated, setHydrated] = useState(false);
  const [form, setForm] = useState({ niche: "Consultorios odontológicos", country: "Argentina", province: "Ciudad Autónoma de Buenos Aires", area: "Recoleta" });
  const [officialProvinces, setOfficialProvinces] = useState<string[]>([]);
  const [officialAreas, setOfficialAreas] = useState<string[]>([]);

  const activeLead = leads.find((lead) => lead.id === activeId) ?? leads[0];
  const filteredLeads = useMemo(() => leads.filter((lead) => lead.name.toLowerCase().includes(query.toLowerCase()) || lead.location.toLowerCase().includes(query.toLowerCase())), [leads, query]);
  const activeCount = leads.filter((lead) => lead.state !== "Guardado").length;
  const selectedNiche = nicheCatalog.find((niche) => niche.name === form.niche) ?? nicheCatalog[0];
  const areaOptions = officialAreas.length ? officialAreas : (areasByProvince[form.province] ?? ["Capital", "Zona norte", "Zona céntrica"]);
  const earliestExpiry = leads.filter((lead) => lead.state !== "Guardado" && lead.expiresAt).map((lead) => lead.expiresAt!).sort((a, b) => a - b)[0];

  useEffect(() => {
    if (isSupabaseConfigured) {
      getSupabaseBrowserClient().auth.getSession().then(async ({ data }) => {
        if (!data.session?.access_token) { window.location.assign("/login"); return; }
        const response = await fetch("/api/prospects", { headers: { Authorization: `Bearer ${data.session.access_token}` } });
        const payload = await response.json() as { prospects?: Lead[] };
        if (response.ok) { setLeads(payload.prospects ?? []); setActiveId(payload.prospects?.[0]?.id ?? 0); }
        else setNotice("No se pudo cargar el CRM cloud. Verificá el esquema de Supabase.");
        setHydrated(true);
      });
      return;
    }
    const saved = window.localStorage.getItem("upcoded-crm-leads");
    if (saved) {
      try {
        const loaded = JSON.parse(saved) as Lead[];
        const migrated = loaded.map((lead) => lead.state === "Guardado" ? { ...lead, expiresAt: undefined } : { ...lead, expiresAt: lead.expiresAt ?? Date.now() + TEMPORARY_WINDOW_MS });
        setLeads(migrated.filter((lead) => lead.state === "Guardado" || !lead.expiresAt || lead.expiresAt > Date.now()));
      } catch { window.localStorage.removeItem("upcoded-crm-leads"); }
    } else {
      setLeads((current) => current.map((lead) => ({ ...lead, expiresAt: Date.now() + TEMPORARY_WINDOW_MS })));
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const timestamp = Date.now();
      setNow(timestamp);
      setLeads((current) => current.filter((lead) => lead.state === "Guardado" || !lead.expiresAt || lead.expiresAt > timestamp));
    }, 30_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => { if (hydrated && !isSupabaseConfigured) window.localStorage.setItem("upcoded-crm-leads", JSON.stringify(leads)); }, [leads, hydrated]);

  useEffect(() => {
    fetch("/api/locations").then((response) => response.json()).then((payload: { items?: { nombre: string }[] }) => setOfficialProvinces((payload.items ?? []).map((item) => item.nombre))).catch(() => undefined);
  }, []);

  useEffect(() => {
    fetch(`/api/locations?province=${encodeURIComponent(form.province)}`).then((response) => response.json()).then((payload: { items?: { nombre: string }[] }) => {
      const areas = (payload.items ?? []).map((item) => item.nombre);
      setOfficialAreas(areas);
      if (areas.length && !areas.includes(form.area)) setForm((current) => ({ ...current, area: areas[0] }));
    }).catch(() => setOfficialAreas([]));
  }, [form.province]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    getSupabaseBrowserClient().auth.getUser().then(({ data }) => {
      if (data.user?.email?.toLowerCase() !== "upcodednow@gmail.com") window.location.assign("/login");
    });
  }, []);

  async function updateLead(id: string | number, state: LeadState) {
    const previous = leads;
    setLeads((current) => current.map((lead) => lead.id === id ? { ...lead, state, expiresAt: state === "Guardado" ? undefined : lead.expiresAt } : lead));
    if (!isSupabaseConfigured) { setNotice(state === "Guardado" ? "Prospecto guardado en el CRM local." : "Marcado para revisión manual."); return; }
    const { data } = await getSupabaseBrowserClient().auth.getSession();
    const response = await fetch(`/api/prospects/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` }, body: JSON.stringify({ state }) });
    const result = await response.json() as { prospect?: Lead; error?: string };
    if (!response.ok || !result.prospect) { setLeads(previous); setNotice(result.error ?? "No se pudo actualizar el prospecto cloud."); return; }
    setLeads((current) => current.map((lead) => lead.id === id ? result.prospect! : lead));
    setNotice(state === "Guardado" ? "Prospecto guardado en Supabase." : "Marcado para revisión manual.");
  }

  async function launchSearch() {
    setIsSearching(true);
    setNotice("Consultando la fuente configurada y preparando evidencia verificable…");
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (isSupabaseConfigured) {
        const { data } = await getSupabaseBrowserClient().auth.getSession();
        if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
      }
      const response = await fetch("/api/prospecting", { method: "POST", headers, body: JSON.stringify(form) });
      const result = await response.json() as { status?: string; message?: string; error?: string; candidates?: Lead[] };
      if (!response.ok || result.status === "configuration_required") { setNotice(result.message ?? result.error ?? "No fue posible iniciar la búsqueda."); return; }
      const candidates = result.candidates ?? [];
      setLeads(candidates); setActiveId(candidates[0]?.id ?? 0);
      setNotice(candidates.length ? `${candidates.length} oportunidades ingresaron a la bandeja temporal con su fuente.` : "No hubo coincidencias seguras. Probá otra zona o rubro.");
    } catch { setNotice("No se pudo consultar la fuente. Verificá que la aplicación esté ejecutándose y la conexión esté disponible."); }
    finally { setIsSearching(false); }
  }

  async function copyMessage() {
    const message = draftUpcodedMessage(activeLead.name.replace(" · demo", ""), activeLead.signals[0] ?? "una oportunidad concreta de mejora");
    await navigator.clipboard?.writeText(message);
    setNotice("Mensaje copiado. Revisalo y personalizalo antes de enviarlo.");
  }

  return (
    <main className={sidebar ? "app-shell" : "app-shell compact"}>
      <aside className="sidebar">
        <div className="brand-row">
          <div className="brand-mark"><Image src="/brand/upcoded-mark-transparent.png" alt="UpCoded" width={34} height={34} priority /></div>
          <div><strong>UpCoded <i>/dev</i></strong><span>OPERATIONS</span></div>
          <button className="icon-button collapse" onClick={() => setSidebar(false)} aria-label="Contraer menú"><PanelLeftClose size={17} /></button>
        </div>
        <nav aria-label="Navegación principal">
          {nav.map(({ label, icon: Icon }) => <button key={label} className={section === label ? "nav-item active" : "nav-item"} onClick={() => setSection(label)}><Icon size={18} /><span>{label}</span>{label === "Prospección" && <b>4</b>}</button>)}
        </nav>
        <div className="sidebar-foot">
          <div className="plan-status"><span><ShieldCheck size={16} /> Plan operativo</span><strong>Base local</strong></div>
          <button className="account"><div className="avatar">JU</div><span><strong>Juan</strong><small>upcodednow@gmail.com</small></span><ChevronDown size={15} /></button>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          {!sidebar && <button className="icon-button" onClick={() => setSidebar(true)} aria-label="Abrir menú"><PanelLeftClose size={17} className="flip" /></button>}
          <div className="crumb"><span>Upcoded CRM</span><ChevronRight size={14} /><strong>{section}</strong></div>
          <div className="top-actions"><button className="icon-button" aria-label="Notificaciones"><Bell size={18} /></button><button className="help-button"><Sparkles size={15} /> Centro de ayuda</button></div>
        </header>

        <div className="workspace">
          {notice && <div className="notice"><Check size={16} /><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Cerrar aviso"><X size={15} /></button></div>}
          {section === "Prospección" ? <>
          <div className="page-heading"><div><h1>Prospección con contexto, no con ruido.</h1><p className="lede">Encontrá negocios para revisar, validá la evidencia y llevá al CRM solo los que realmente valen una conversación.</p></div><button className="primary-button" onClick={launchSearch} disabled={isSearching}><Plus size={18} /> Nueva búsqueda</button></div>

          <section className="search-studio" aria-label="Nueva búsqueda de prospectos">
            <div className="studio-head"><div><h2>Definí el terreno</h2><p>El filtro geográfico evita resultados imprecisos y permite guardar búsquedas repetibles.</p></div><span className="free-badge">Configuración gratuita</span></div>
            <div className="form-grid">
              <label>Rubro<div className="select-wrap"><Building2 size={16} /><select value={form.niche} onChange={(event) => setForm({ ...form, niche: event.target.value })}>{nicheCatalog.map((niche) => <option key={niche.name}>{niche.name}</option>)}</select><ChevronDown size={15} /></div></label>
              <label>País<div className="select-wrap"><Globe2 size={16} /><select value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })}><option>Argentina</option></select><ChevronDown size={15} /></div></label>
              <label>Provincia / jurisdicción<div className="select-wrap"><MapPin size={16} /><select value={form.province} onChange={(event) => { const province = event.target.value; setOfficialAreas([]); setForm({ ...form, province, area: (areasByProvince[province] ?? ["Capital"])[0] }); }}>{(officialProvinces.length ? officialProvinces : provinces).map((province) => <option key={province}>{province}</option>)}</select><ChevronDown size={15} /></div></label>
              <label>Zona, partido o barrio<div className="select-wrap"><Target size={16} /><select value={form.area} onChange={(event) => setForm({ ...form, area: event.target.value })}>{areaOptions.map((area) => <option key={area}>{area}</option>)}</select><ChevronDown size={15} /></div></label>
            </div>
            <div className="opportunity-guide" aria-live="polite"><div><span>Índice de prioridad web</span><strong>{selectedNiche.opportunity}<small>%</small></strong></div><div className="opportunity-meter" aria-label={`Índice de prioridad web: ${selectedNiche.opportunity}%`}><i style={{ width: `${selectedNiche.opportunity}%` }} /></div><p>{selectedNiche.reason}</p><small>Orientativo: ayuda a priorizar campañas; no representa una tasa garantizada de cierre.</small></div>
            <div className="studio-footer"><span><Clock3 size={15} /> Los resultados nuevos vencen en 24 h si no los guardás.</span><button className="run-button" onClick={launchSearch} disabled={isSearching}><Search size={17} /> {isSearching ? "Buscando…" : "Buscar oportunidades"}</button></div>
          </section>

          <section className="metrics" aria-label="Resumen de resultados">
            <div><span>Oportunidades activas</span><strong>{activeCount}</strong><small><ArrowUpRight size={13} /> ventana actual</small></div>
            <div><span>Alta prioridad</span><strong>{leads.filter((lead) => lead.score >= 80).length}</strong><small>score de oportunidad ≥ 80</small></div>
            <div><span>Para validar</span><strong>{leads.filter((lead) => lead.state === "Revisar").length}</strong><small>requieren revisión humana</small></div>
            <div><span>Vencimiento del lote</span><strong>{earliestExpiry ? formatRemaining(earliestExpiry - now) : "—"}</strong><small>{earliestExpiry ? "actualización cada 30 s" : "las guardadas no vencen"}</small></div>
          </section>

          <section className="results-section">
            <div className="results-heading"><div><h2>Bandeja temporal</h2><p>Datos de demostración · el flujo final mostrará evidencia y fuentes por cada señal.</p></div><div className="result-actions"><label className="search-input"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar en este lote" /></label><button className={showFilters ? "filter active" : "filter"} onClick={() => setShowFilters(!showFilters)}><SlidersHorizontal size={16} /> Filtros</button></div></div>
            {showFilters && <div className="filter-strip"><span>Estado:</span><button>Todos</button><button>Alta prioridad</button><button>Revisión manual</button><span className="filter-hint">Los filtros avanzados se conectarán a la búsqueda real.</span></div>}
            <div className="results-layout">
              <div className="lead-table" role="table">
                <div className="table-row table-head" role="row"><span>Negocio</span><span>Presencia web</span><span>Oportunidad</span><span>Estado</span><span /></div>
                {filteredLeads.map((lead) => <button key={lead.id} className={activeLead?.id === lead.id ? "table-row lead-row selected" : "table-row lead-row"} onClick={() => setActiveId(lead.id)} role="row"><span className="business"><span className="business-icon"><Building2 size={17} /></span><span><strong>{lead.name}</strong><small>{lead.category} · {lead.location}</small></span></span><span className="site-status"><Globe2 size={15} />{lead.site}</span><span className="score"><b>{lead.score}</b><i style={{ width: `${lead.score}%` }} /></span><span><em className={`state ${stateClass[lead.state]}`}>{lead.state}</em></span><span><MoreHorizontal size={18} /></span></button>)}
              </div>
              {activeLead && <aside className="lead-detail"><div className="detail-top"><span className="demo-tag">{activeLead.name.includes("demo") ? "EJEMPLO" : "CON FUENTE"}</span><button className="icon-button" onClick={() => setActiveId(0)} aria-label="Cerrar detalle"><X size={16} /></button></div><h3>{activeLead.name}</h3><p>{activeLead.category} · {activeLead.location}</p><div className="score-split"><div><span>Oportunidad</span><strong>{activeLead.score}</strong><small>/ 100</small></div><div><span>Confianza</span><strong>{activeLead.confidence}%</strong><small>evidencia</small></div></div><div className="evidence"><h4>Señales encontradas</h4>{activeLead.signals.map((signal) => <p key={signal}><Check size={15} /> {signal}</p>)}{activeLead.sourceUrl && <a href={activeLead.sourceUrl} target="_blank" rel="noreferrer"><Globe2 size={14} /> Abrir fuente encontrada</a>}</div><div className="detail-actions"><button className="primary-button full" onClick={() => updateLead(activeLead.id, "Guardado")}><Check size={17} /> Guardar en CRM</button><button className="secondary-button full" onClick={() => updateLead(activeLead.id, "Revisar")}><RefreshCw size={16} /> Pedir revisión</button></div><div className="message-box"><div><MessageSquareText size={16} /><span>Primer contacto</span></div><p>Una apertura breve, con una observación concreta y sin tono automatizado.</p><button onClick={copyMessage}><Copy size={15} /> Copiar borrador</button></div><small className="expiry"><Clock3 size={14} /> {activeLead.state === "Guardado" ? "Conservado en CRM: no vence." : `Se elimina en ${formatRemaining((activeLead.expiresAt ?? now) - now)} si no lo guardás.`}</small></aside>}
            </div>
          </section>
          </> : <OperationsPanel section={section} leads={leads} />}
        </div>
      </section>
    </main>
  );
}
