import { ArrowUpRight, Building2, Check, ChevronDown, Clock3, Globe2, MapPin, Maximize2, MessageSquareText, Plus, RefreshCw, Search, SlidersHorizontal, Target, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { formatRemaining, isTemporary, type Lead } from "@/lib/crm";
import { StageBadge, type PanelProps } from "@/app/components/ui";

export type SearchForm = { niche: string; country: string; province: string; area: string };

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

type StatusFilter = "todos" | "alta" | "revisar";

export function ProspectingPanel({ leads, now, onOpen, onUpdate, onCompose, onSearch }: PanelProps & { onSearch: (form: SearchForm) => Promise<Lead[]> }) {
  const [form, setForm] = useState<SearchForm>({ niche: "Consultorios odontológicos", country: "Argentina", province: "Ciudad Autónoma de Buenos Aires", area: "" });
  const [officialProvinces, setOfficialProvinces] = useState<string[]>([]);
  const [officialAreas, setOfficialAreas] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [provinceFilter, setProvinceFilter] = useState("todas");
  const [status, setStatus] = useState<StatusFilter>("todos");
  const [showFilters, setShowFilters] = useState(false);
  const [activeId, setActiveId] = useState<string>();

  const temporary = leads.filter((lead) => isTemporary(lead) && lead.state !== "descartado");
  const selectedNiche = nicheCatalog.find((niche) => niche.name === form.niche) ?? nicheCatalog[0];
  const earliestExpiry = temporary.filter((lead) => lead.expiresAt).map((lead) => lead.expiresAt!).sort((a, b) => a - b)[0];

  const provinceCounts = useMemo(() => temporary.reduce<Record<string, number>>((acc, lead) => ({ ...acc, [lead.province || "Sin provincia"]: (acc[lead.province || "Sin provincia"] ?? 0) + 1 }), {}), [temporary]);
  const filtered = temporary.filter((lead) => {
    const text = `${lead.name} ${lead.location} ${lead.category}`.toLowerCase();
    if (query && !text.includes(query.toLowerCase())) return false;
    if (provinceFilter !== "todas" && (lead.province || "Sin provincia") !== provinceFilter) return false;
    if (status === "alta" && lead.score < 80) return false;
    if (status === "revisar" && lead.state !== "revisar") return false;
    return true;
  });
  const groups = Object.entries(filtered.reduce<Record<string, Lead[]>>((acc, lead) => {
    const key = lead.province || "Sin provincia";
    (acc[key] ??= []).push(lead);
    return acc;
  }, {})).sort((a, b) => b[1].length - a[1].length).map(([province, items]) => [province, items.sort((a, b) => b.score - a.score)] as const);
  const activeLead = filtered.find((lead) => lead.id === activeId) ?? (activeId === "" ? undefined : filtered[0]);

  useEffect(() => {
    fetch("/api/locations").then((response) => response.json()).then((payload: { items?: { nombre: string }[] }) => setOfficialProvinces((payload.items ?? []).map((item) => item.nombre))).catch(() => undefined);
  }, []);

  useEffect(() => {
    setOfficialAreas([]);
    fetch(`/api/locations?province=${encodeURIComponent(form.province)}`).then((response) => response.json()).then((payload: { items?: { nombre: string }[] }) => setOfficialAreas((payload.items ?? []).map((item) => item.nombre))).catch(() => undefined);
  }, [form.province]);

  async function search() {
    setIsSearching(true);
    const found = await onSearch(form);
    setIsSearching(false);
    if (found.length) { setProvinceFilter(form.province); setActiveId(found[0].id); }
  }

  return <>
    <div className="page-heading"><div><h1>Prospección por provincia.</h1><p className="lede">Elegí rubro y provincia. La zona es opcional: sólo acota la búsqueda. Los resultados se agrupan por provincia y vencen en 24 h si nadie los guarda.</p></div><button className="primary-button" onClick={search} disabled={isSearching}><Plus size={18} /> Nueva búsqueda</button></div>

    <section className="search-studio" aria-label="Nueva búsqueda de prospectos">
      <div className="studio-head"><div><h2>Definí el terreno</h2><p>La provincia es el criterio principal; acotá por partido o localidad sólo si lo necesitás.</p></div><span className="free-badge">Configuración gratuita</span></div>
      <div className="form-grid">
        <label>Rubro<div className="select-wrap"><Building2 size={16} /><select value={form.niche} onChange={(event) => setForm({ ...form, niche: event.target.value })}>{nicheCatalog.map((niche) => <option key={niche.name}>{niche.name}</option>)}</select><ChevronDown size={15} /></div></label>
        <label>País<div className="select-wrap"><Globe2 size={16} /><select value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })}><option>Argentina</option></select><ChevronDown size={15} /></div></label>
        <label>Provincia<div className="select-wrap"><MapPin size={16} /><select value={form.province} onChange={(event) => setForm({ ...form, province: event.target.value, area: "" })}>{(officialProvinces.length ? officialProvinces : provinces).map((province) => <option key={province}>{province}</option>)}</select><ChevronDown size={15} /></div></label>
        <label>Zona (opcional)<div className="select-wrap"><Target size={16} /><select value={form.area} onChange={(event) => setForm({ ...form, area: event.target.value })}><option value="">Toda la provincia</option>{officialAreas.map((area) => <option key={area}>{area}</option>)}</select><ChevronDown size={15} /></div></label>
      </div>
      <div className="opportunity-guide" aria-live="polite"><div><span>Índice de prioridad web</span><strong>{selectedNiche.opportunity}<small>%</small></strong></div><div className="opportunity-meter" aria-label={`Índice de prioridad web: ${selectedNiche.opportunity}%`}><i style={{ width: `${selectedNiche.opportunity}%` }} /></div><p>{selectedNiche.reason}</p><small>Orientativo: ayuda a priorizar campañas; no representa una tasa garantizada de cierre.</small></div>
      <div className="studio-footer"><span><Clock3 size={15} /> Buscando en {form.area ? `${form.area}, ${form.province}` : `toda la provincia de ${form.province}`}.</span><button className="run-button" onClick={search} disabled={isSearching}><Search size={17} /> {isSearching ? "Buscando…" : "Buscar oportunidades"}</button></div>
    </section>

    <section className="metrics" aria-label="Resumen de la bandeja">
      <div><span>En bandeja</span><strong>{temporary.length}</strong><small><ArrowUpRight size={13} /> {Object.keys(provinceCounts).length} provincia{Object.keys(provinceCounts).length === 1 ? "" : "s"}</small></div>
      <div><span>Alta prioridad</span><strong>{temporary.filter((lead) => lead.score >= 80).length}</strong><small>score de oportunidad ≥ 80</small></div>
      <div><span>Para validar</span><strong>{temporary.filter((lead) => lead.state === "revisar").length}</strong><small>requieren revisión humana</small></div>
      <div><span>Vencimiento del lote</span><strong>{earliestExpiry ? formatRemaining(earliestExpiry - now) : "—"}</strong><small>{earliestExpiry ? "actualización cada 30 s" : "las guardadas no vencen"}</small></div>
    </section>

    <section className="results-section">
      <div className="results-heading"><div><h2>Bandeja temporal</h2><p>Agrupada por provincia. Guardá en el CRM lo que valga una conversación; el resto se elimina solo.</p></div><div className="result-actions"><label className="search-input"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar en la bandeja" aria-label="Buscar en la bandeja" /></label><button className={showFilters ? "filter active" : "filter"} onClick={() => setShowFilters(!showFilters)}><SlidersHorizontal size={16} /> Filtros</button></div></div>
      <div className="chip-row" role="tablist" aria-label="Provincia">
        <button role="tab" aria-selected={provinceFilter === "todas"} className={provinceFilter === "todas" ? "chip active" : "chip"} onClick={() => setProvinceFilter("todas")}>Todas <b>{temporary.length}</b></button>
        {Object.entries(provinceCounts).sort((a, b) => b[1] - a[1]).map(([province, count]) => <button key={province} role="tab" aria-selected={provinceFilter === province} className={provinceFilter === province ? "chip active" : "chip"} onClick={() => setProvinceFilter(province)}>{province} <b>{count}</b></button>)}
      </div>
      {showFilters && <div className="filter-strip"><span>Estado:</span>{([["todos", "Todos"], ["alta", "Alta prioridad"], ["revisar", "Revisión manual"]] as const).map(([value, label]) => <button key={value} className={status === value ? "active" : ""} onClick={() => setStatus(value)}>{label}</button>)}</div>}
      <div className="results-layout">
        <div className="lead-table" role="table">
          <div className="table-row table-head" role="row"><span>Negocio</span><span>Presencia web</span><span>Oportunidad</span><span>Estado</span><span /></div>
          {groups.length ? groups.map(([province, items]) => <div key={province} role="rowgroup">
            <div className="group-row" role="row"><MapPin size={13} /> {province} <b>{items.length}</b></div>
            {items.map((lead) => <button key={lead.id} className={activeLead?.id === lead.id ? "table-row lead-row selected" : "table-row lead-row"} onClick={() => setActiveId(lead.id)} role="row"><span className="business"><span className="business-icon"><Building2 size={17} /></span><span><strong>{lead.name}</strong><small>{lead.category}{lead.locality ? ` · ${lead.locality}` : ""}</small></span></span><span className="site-status"><Globe2 size={15} />{lead.site}</span><span className="score"><b>{lead.score}</b><i style={{ width: `${lead.score}%` }} /></span><span><StageBadge stage={lead.state} /></span><span /></button>)}
          </div>) : <div className="operation-empty"><Search size={22} /><strong>La bandeja está vacía.</strong><span>Lanzá una búsqueda por provincia para traer prospectos nuevos.</span></div>}
        </div>
        {activeLead && <aside className="lead-detail">
          <div className="detail-top"><span className="demo-tag">{activeLead.name.includes("demo") ? "EJEMPLO" : "CON FUENTE"}</span><button className="icon-button" onClick={() => setActiveId("")} aria-label="Cerrar detalle"><X size={16} /></button></div>
          <h3>{activeLead.name}</h3><p>{activeLead.category} · {activeLead.location}</p>
          <div className="score-split"><div><span>Oportunidad</span><strong>{activeLead.score}</strong><small>/ 100</small></div><div><span>Confianza</span><strong>{activeLead.confidence}%</strong><small>evidencia</small></div></div>
          <div className="evidence"><h4>Señales encontradas</h4>{activeLead.signals.map((signal) => <p key={signal}><Check size={15} /> {signal}</p>)}{activeLead.sourceUrl && <a href={activeLead.sourceUrl} target="_blank" rel="noreferrer"><Globe2 size={14} /> Abrir fuente encontrada</a>}</div>
          <div className="detail-actions">
            <button className="primary-button full" onClick={() => onUpdate(activeLead.id, { state: "guardado" }, `${activeLead.name} quedó en el CRM, asignado a vos.`)}><Check size={17} /> Guardar en CRM</button>
            <button className="secondary-button full" onClick={() => onOpen(activeLead.id)}><Maximize2 size={15} /> Ver ficha completa</button>
            <div className="split-actions">
              <button className="secondary-button" onClick={() => onUpdate(activeLead.id, { state: "revisar" }, "Marcado para revisión manual.")}><RefreshCw size={15} /> Revisar</button>
              <button className="secondary-button" onClick={() => onUpdate(activeLead.id, { state: "descartado" }, "Descartado. Se eliminará al vencer la ventana.")}><Trash2 size={15} /> Descartar</button>
            </div>
          </div>
          <div className="message-box"><div><MessageSquareText size={16} /><span>Primer contacto</span></div><p>Abre el redactor con la observación principal. Al registrar el envío, pasa al CRM a tu nombre.</p><button onClick={() => onCompose(activeLead.id)}><MessageSquareText size={15} /> Escribir mensaje</button></div>
          <small className="expiry"><Clock3 size={14} /> {`Se elimina en ${formatRemaining((activeLead.expiresAt ?? now) - now)} si no lo guardás.`}</small>
        </aside>}
      </div>
    </section>
  </>;
}
