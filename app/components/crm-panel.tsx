import { Building2, ClipboardList, Columns3, Download, Rows3, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { formatDate, PIPELINE_STAGES, relativeDue, stageLabel, type Lead, type Stage } from "@/lib/crm";
import { AssigneeSelect, StageBadge, type PanelProps } from "@/app/components/ui";
import { KanbanBoard } from "@/app/components/kanban-board";

type OwnerFilter = "mios" | "todos" | "sin_asignar" | string;

export function CrmPanel({ leads, team, me, now, onOpen, onUpdate }: PanelProps) {
  const [owner, setOwner] = useState<OwnerFilter>("mios");
  const [stage, setStage] = useState<Stage | "activos" | "todas">("activos");
  const [province, setProvince] = useState("todas");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"tabla" | "tablero">("tabla");

  const pipeline = useMemo(() => leads.filter((lead) => PIPELINE_STAGES.includes(lead.state)), [leads]);
  const byOwner = pipeline.filter((lead) => owner === "todos" ? true : owner === "mios" ? lead.assignedTo === me.email : owner === "sin_asignar" ? !lead.assignedTo : lead.assignedTo === owner);
  const stageCount = (value: Stage) => byOwner.filter((lead) => lead.state === value).length;
  const provinces = [...new Set(pipeline.map((lead) => lead.province || "Sin provincia"))].sort((a, b) => a.localeCompare(b, "es"));
  const scoped = byOwner
    .filter((lead) => province === "todas" || (lead.province || "Sin provincia") === province)
    .filter((lead) => !query || `${lead.name} ${lead.category} ${lead.location}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => (a.nextFollowUpAt ?? "9").localeCompare(b.nextFollowUpAt ?? "9") || b.score - a.score);
  const rows = view === "tablero" ? scoped : scoped.filter((lead) => stage === "todas" ? true : stage === "activos" ? !["cliente", "perdido", "no_contactar"].includes(lead.state) : lead.state === stage);

  function moveTo(id: string, target: Stage) {
    const lead = leads.find((item) => item.id === id);
    if (lead && lead.state !== target) onUpdate(id, { state: target }, `${lead.name}: ${stageLabel[target]}.`);
  }

  function exportCsv() {
    const header = ["nombre", "rubro", "provincia", "localidad", "etapa", "responsable", "telefono", "email", "web", "instagram", "ultimo_contacto", "proximo_seguimiento", "oportunidad", "notas"];
    const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const lines = rows.map((lead) => [lead.name, lead.category, lead.province, lead.locality, stageLabel[lead.state], team.find((member) => member.email === lead.assignedTo)?.name ?? "", lead.phone, lead.email, lead.websiteUrl, lead.instagramUrl, lead.lastContactedAt, lead.nextFollowUpAt, lead.score, lead.notes].map(escape).join(","));
    const url = URL.createObjectURL(new Blob([`﻿${[header.join(","), ...lines].join("\n")}`], { type: "text/csv;charset=utf-8" }));
    const link = Object.assign(document.createElement("a"), { href: url, download: `upcoded-crm-${new Date().toISOString().slice(0, 10)}.csv` });
    link.click();
    URL.revokeObjectURL(url);
  }

  return <>
    <div className="page-heading"><div><h1>CRM del equipo.</h1><p className="lede">Cada prospecto tiene un responsable. Filtrá por miembro para ver sólo tu cartera y hacé click en un prospecto para abrir la ficha completa. En el tablero, arrastralo para cambiarlo de etapa.</p></div>
      <div className="result-actions">
        <div className="segmented small" role="tablist" aria-label="Vista">
          <button role="tab" aria-selected={view === "tabla"} className={view === "tabla" ? "active" : ""} onClick={() => setView("tabla")}><Rows3 size={14} /> Tabla</button>
          <button role="tab" aria-selected={view === "tablero"} className={view === "tablero" ? "active" : ""} onClick={() => setView("tablero")}><Columns3 size={14} /> Tablero</button>
        </div>
        <button className="secondary-button" onClick={exportCsv} disabled={!rows.length}><Download size={15} /> Exportar CSV</button>
      </div></div>

    <div className="crm-toolbar">
      <div className="segmented" role="tablist" aria-label="Responsable">
        {[{ id: "mios", label: "Míos" }, ...team.filter((member) => member.email !== me.email).map((member) => ({ id: member.email, label: member.name })), { id: "sin_asignar", label: "Sin asignar" }, { id: "todos", label: "Todos" }].map((option) => <button key={option.id} role="tab" aria-selected={owner === option.id} className={owner === option.id ? "active" : ""} onClick={() => setOwner(option.id)}>{option.label}</button>)}
      </div>
      <div className="result-actions">
        <label className="search-input dark-select"><select value={province} onChange={(event) => setProvince(event.target.value)} aria-label="Provincia"><option value="todas">Todas las provincias</option>{provinces.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="search-input"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar en el CRM" aria-label="Buscar en el CRM" /></label>
      </div>
    </div>

    {view === "tablero" ? <KanbanBoard leads={scoped} team={team} now={now} onOpen={onOpen} onMove={moveTo} /> : <>
    <div className="chip-row" role="tablist" aria-label="Etapa">
      <button role="tab" aria-selected={stage === "activos"} className={stage === "activos" ? "chip active" : "chip"} onClick={() => setStage("activos")}>Activos <b>{byOwner.filter((lead) => !["cliente", "perdido", "no_contactar"].includes(lead.state)).length}</b></button>
      {PIPELINE_STAGES.map((value) => <button key={value} role="tab" aria-selected={stage === value} className={stage === value ? "chip active" : "chip"} onClick={() => setStage(value)}>{stageLabel[value]} <b>{stageCount(value)}</b></button>)}
      <button role="tab" aria-selected={stage === "todas"} className={stage === "todas" ? "chip active" : "chip"} onClick={() => setStage("todas")}>Todas <b>{byOwner.length}</b></button>
    </div>

    <div className="lead-table crm-table" role="table">
      <div className="table-row table-head" role="row"><span>Negocio</span><span>Etapa</span><span>Responsable</span><span>Último contacto</span><span>Seguimiento</span><span>Opor.</span></div>
      {rows.length ? rows.map((lead: Lead) => {
        const overdue = lead.nextFollowUpAt && Date.parse(lead.nextFollowUpAt) < now && ["contactado", "respondio", "reunion"].includes(lead.state);
        return <div key={lead.id} className="table-row lead-row" role="row" tabIndex={0} onClick={() => onOpen(lead.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen(lead.id); } }}>
          <span className="business"><span className="business-icon"><Building2 size={17} /></span><span><strong>{lead.name}</strong><small>{lead.category} · {lead.province || lead.location}</small></span></span>
          <span><StageBadge stage={lead.state} /></span>
          <span><AssigneeSelect lead={lead} team={team} onUpdate={onUpdate} compact /></span>
          <span className="cell-muted">{lead.lastContactedAt ? `${formatDate(lead.lastContactedAt)} · ${team.find((member) => member.email === lead.lastContactedBy)?.initials ?? ""}` : "Nunca"}</span>
          <span className={overdue ? "cell-due overdue" : "cell-due"}>{lead.nextFollowUpAt ? `${formatDate(lead.nextFollowUpAt)} (${relativeDue(lead.nextFollowUpAt, now)})` : "—"}</span>
          <span className="score"><b>{lead.score}</b></span>
        </div>;
      }) : <div className="operation-empty"><ClipboardList size={24} /><strong>No hay prospectos con estos filtros.</strong><span>Guardá oportunidades desde la bandeja de Prospección o cambiá el filtro de responsable.</span></div>}
    </div>
    </>}
  </>;
}
