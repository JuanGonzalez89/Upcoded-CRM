"use client";

import { Bell, ChevronDown, ChevronRight, Check, KanbanSquare, LayoutDashboard, LogOut, MessageSquareText, PanelLeftClose, Radar, Settings2, ShieldCheck, Sparkles, UserRoundCog, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ApiError, api, readLocal, writeLocal } from "@/lib/client-api";
import { applyLocalPatch, buildTickets, DEFAULT_SETTINGS, DEFAULT_TEAM, describeSearch, isTemporary, type Lead, type LeadPatch, type SearchSummary, type Settings, type TeamMember } from "@/lib/crm";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase-browser";
import { Avatar, type Section } from "@/app/components/ui";
import { HomePanel } from "@/app/components/home-panel";
import { ProspectingPanel, type SearchForm } from "@/app/components/prospecting-panel";
import { CrmPanel } from "@/app/components/crm-panel";
import { MessagesPanel } from "@/app/components/messages-panel";
import { SettingsPanel, type Services } from "@/app/components/settings-panel";
import { ProspectDrawer } from "@/app/components/prospect-drawer";

const TEMPORARY_WINDOW_MS = 24 * 60 * 60 * 1000;
const LOCAL_KEYS = { leads: "upcoded-crm-leads-v2", me: "upcoded-crm-me", settings: "upcoded-crm-settings", team: "upcoded-crm-team" };

function demoLead(partial: Pick<Lead, "id" | "name" | "category" | "province" | "locality" | "state" | "score" | "confidence" | "site" | "signals"> & Partial<Lead>): Lead {
  return { location: [partial.locality, partial.province].filter(Boolean).join(", "), evidence: [], phone: "", email: "", notes: "", createdAt: new Date().toISOString(), activity: [], messages: [], expiresAt: Date.now() + TEMPORARY_WINDOW_MS, ...partial };
}

const demoLeads: Lead[] = [
  demoLead({ id: "demo-1", name: "Lumen Odontología · demo", category: "Consultorios odontológicos", province: "Ciudad Autónoma de Buenos Aires", locality: "Recoleta", state: "nuevo", score: 91, confidence: 87, site: "No localizada", signals: ["No se encontró dominio verificable", "Instagram activo"] }),
  demoLead({ id: "demo-2", name: "Casa Naranjo Eventos · demo", category: "Salones de eventos", province: "Ciudad Autónoma de Buenos Aires", locality: "Palermo", state: "revisar", score: 84, confidence: 62, site: "Revisión manual", signals: ["La bio de Instagram podría contener un enlace", "Sin web confirmada"] }),
  demoLead({ id: "demo-3", name: "Estudio Río Propiedades · demo", category: "Inmobiliarias", province: "Buenos Aires", locality: "Vicente López", state: "nuevo", score: 76, confidence: 89, site: "Con fricción", signals: ["Sitio lento en móvil", "Contacto poco visible"] }),
  demoLead({ id: "demo-4", name: "Consultorios Norte · demo", category: "Clínicas y centros médicos", province: "Córdoba", locality: "Córdoba Capital", state: "nuevo", score: 72, confidence: 78, site: "Con fricción", signals: ["HTTPS correcto", "Sin llamada a la acción clara"] }),
];

const nav: { label: Section; icon: typeof Radar }[] = [
  { label: "Inicio", icon: LayoutDashboard },
  { label: "Prospección", icon: Radar },
  { label: "CRM", icon: KanbanSquare },
  { label: "Mensajes", icon: MessageSquareText },
  { label: "Configuración", icon: Settings2 },
];

export default function Home() {
  const [section, setSection] = useState<Section>("Inicio");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [team, setTeam] = useState<TeamMember[]>(DEFAULT_TEAM);
  const [meEmail, setMeEmail] = useState(DEFAULT_TEAM[0].email);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [services, setServices] = useState<Services>({ supabase: isSupabaseConfigured, tavily: false });
  const [drawerId, setDrawerId] = useState<string>();
  const [composeId, setComposeId] = useState<string>();
  const [sidebar, setSidebar] = useState(true);
  const [accountMenu, setAccountMenu] = useState(false);
  const [notice, setNotice] = useState("");
  const [now, setNow] = useState(Date.now());
  const [hydrated, setHydrated] = useState(false);
  const lastMutationAt = useRef(0);

  const me = team.find((member) => member.email === meEmail) ?? team[0];
  const drawerLead = leads.find((lead) => lead.id === drawerId);
  const myTicketCount = useMemo(() => buildTickets(leads, meEmail, "mios", now).length, [leads, meEmail, now]);
  const temporaryCount = leads.filter((lead) => isTemporary(lead) && lead.state !== "descartado").length;
  const badgeFor = (label: Section) => label === "Inicio" ? myTicketCount : label === "Prospección" ? temporaryCount : 0;

  useEffect(() => {
    if (!isSupabaseConfigured) {
      const storedTeam = readLocal<TeamMember[]>(LOCAL_KEYS.team, DEFAULT_TEAM);
      setTeam(storedTeam);
      setMeEmail(readLocal(LOCAL_KEYS.me, storedTeam[0].email));
      setSettings({ ...DEFAULT_SETTINGS, ...readLocal<Partial<Settings>>(LOCAL_KEYS.settings, {}) });
      setLeads(readLocal<Lead[]>(LOCAL_KEYS.leads, demoLeads).filter((lead) => !isTemporary(lead) || !lead.expiresAt || lead.expiresAt > Date.now()));
      setHydrated(true);
      return;
    }
    getSupabaseBrowserClient().auth.getSession().then(async ({ data }) => {
      if (!data.session?.access_token) { window.location.assign("/login"); return; }
      try {
        const [teamResult, prospectsResult, settingsResult] = await Promise.all([
          api<{ me: TeamMember; team: TeamMember[] }>("/api/team"),
          api<{ prospects: Lead[] }>("/api/prospects"),
          api<{ settings: Settings; services: Services }>("/api/settings"),
        ]);
        setTeam(teamResult.team);
        setMeEmail(teamResult.me.email);
        setLeads(prospectsResult.prospects);
        setSettings(settingsResult.settings);
        setServices(settingsResult.services);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          await getSupabaseBrowserClient().auth.signOut();
          window.location.assign("/login?error=equipo");
          return;
        }
        setNotice(error instanceof Error ? error.message : "No se pudo cargar el CRM.");
      }
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const timestamp = Date.now();
      setNow(timestamp);
      setLeads((current) => current.filter((lead) => !isTemporary(lead) || !lead.expiresAt || lead.expiresAt > timestamp));
    }, 30_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => { if (hydrated && !isSupabaseConfigured) writeLocal(LOCAL_KEYS.leads, leads); }, [leads, hydrated]);

  // Sincronización entre miembros: recarga al volver a la pestaña y cada minuto mientras está visible.
  useEffect(() => {
    if (!isSupabaseConfigured || !hydrated) return;
    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      const startedAt = Date.now();
      try {
        const [{ prospects }, { settings: shared }] = await Promise.all([api<{ prospects: Lead[] }>("/api/prospects"), api<{ settings: Settings }>("/api/settings")]);
        // Si hubo un cambio propio mientras la recarga viajaba, esta respuesta puede ser vieja.
        if (lastMutationAt.current > startedAt) return;
        setLeads(prospects);
        setSettings(shared);
      } catch { /* se reintenta en el próximo ciclo */ }
    };
    const interval = window.setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.clearInterval(interval); document.removeEventListener("visibilitychange", refresh); };
  }, [hydrated]);

  const updateLead = useCallback(async (id: string, patch: LeadPatch, message?: string) => {
    if (!isSupabaseConfigured) {
      setLeads((current) => current.map((lead) => lead.id === id ? applyLocalPatch(lead, patch, meEmail, team, settings) : lead));
      if (message) setNotice(message);
      return true;
    }
    try {
      lastMutationAt.current = Date.now();
      const { prospect } = await api<{ prospect: Lead }>(`/api/prospects/${id}`, { method: "PATCH", body: patch });
      setLeads((current) => current.map((lead) => lead.id === id ? prospect : lead));
      if (message) setNotice(message);
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo actualizar el prospecto.");
      return false;
    }
  }, [meEmail, team, settings]);

  async function launchSearch(form: SearchForm) {
    setNotice("Consultando la fuente configurada y preparando evidencia verificable…");
    try {
      const result = await api<{ status?: string; message?: string; candidates?: Lead[] } & Partial<SearchSummary>>("/api/prospecting", { method: "POST", body: form });
      if (result.status === "configuration_required") { setNotice(result.message ?? "Falta configurar la fuente de búsqueda."); return []; }
      const candidates = result.candidates ?? [];
      setLeads((current) => [...candidates, ...current]);
      setNotice(describeSearch(candidates.length, form.province, { mapa: result.mapa ?? 0, web: result.web ?? candidates.length, mapAvailable: result.mapAvailable ?? false, editorialDiscarded: result.editorialDiscarded ?? 0, duplicates: result.duplicates ?? [] }, team));
      return candidates;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo consultar la fuente.");
      return [];
    }
  }

  async function saveSettings(next: Settings) {
    if (!isSupabaseConfigured) { setSettings(next); writeLocal(LOCAL_KEYS.settings, next); setNotice("Configuración guardada en este navegador."); return; }
    try {
      const result = await api<{ settings: Settings; services: Services }>("/api/settings", { method: "PUT", body: next });
      setSettings(result.settings);
      setNotice("Configuración guardada para todo el equipo.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se pudo guardar la configuración."); }
  }

  async function saveProfile(name: string, initials: string) {
    if (!isSupabaseConfigured) {
      const nextTeam = team.map((member) => member.email === meEmail ? { ...member, name, initials: initials.toUpperCase() } : member);
      setTeam(nextTeam); writeLocal(LOCAL_KEYS.team, nextTeam); setNotice("Perfil actualizado.");
      return;
    }
    try {
      const result = await api<{ me: TeamMember }>("/api/team", { method: "PATCH", body: { name, initials } });
      setTeam((current) => current.map((member) => member.email === result.me.email ? result.me : member));
      setNotice("Perfil actualizado.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se pudo actualizar el perfil."); }
  }

  async function switchAccount(email?: string) {
    setAccountMenu(false);
    if (!isSupabaseConfigured && email) { setMeEmail(email); writeLocal(LOCAL_KEYS.me, email); setNotice(`Ahora estás operando como ${team.find((member) => member.email === email)?.name}.`); return; }
    await getSupabaseBrowserClient().auth.signOut();
    window.location.assign("/login");
  }

  function compose(id: string) {
    setComposeId(id);
    setDrawerId(undefined);
    setSection("Mensajes");
  }

  const panelProps = { leads, team, me, now, settings, onOpen: setDrawerId, onUpdate: updateLead, onCompose: compose };

  return (
    <main className={sidebar ? "app-shell" : "app-shell compact"}>
      <aside className="sidebar">
        <div className="brand-row">
          <div className="brand-mark"><Image src="/brand/upcoded-mark-transparent.png" alt="UpCoded" width={34} height={34} priority /></div>
          <div><strong>UpCoded <i>/dev</i></strong><span>OPERATIONS</span></div>
          <button className="icon-button collapse" onClick={() => setSidebar(false)} aria-label="Contraer menú"><PanelLeftClose size={17} /></button>
        </div>
        <nav aria-label="Navegación principal">
          {nav.map(({ label, icon: Icon }) => {
            const badge = badgeFor(label);
            return <button key={label} className={section === label ? "nav-item active" : "nav-item"} onClick={() => setSection(label)}><Icon size={18} /><span>{label}</span>{badge > 0 && <b>{badge}</b>}</button>;
          })}
        </nav>
        <div className="sidebar-foot">
          <div className="plan-status"><span><ShieldCheck size={16} /> Equipo Upcoded · {team.length} miembros</span><strong>{isSupabaseConfigured ? "Supabase" : "Modo local"}</strong></div>
          <div className="account-wrap">
            {accountMenu && <div className="account-menu" role="menu">
              {!isSupabaseConfigured && team.filter((member) => member.email !== meEmail).map((member) => <button key={member.email} role="menuitem" onClick={() => switchAccount(member.email)}><UserRoundCog size={15} /> Operar como {member.name}</button>)}
              <button role="menuitem" onClick={() => { setAccountMenu(false); setSection("Configuración"); }}><Settings2 size={15} /> Mi perfil</button>
              {isSupabaseConfigured && <button role="menuitem" onClick={() => switchAccount()}><LogOut size={15} /> Cerrar sesión</button>}
            </div>}
            <button className="account" onClick={() => setAccountMenu(!accountMenu)} aria-expanded={accountMenu}><Avatar member={me} /><span><strong>{me?.name}</strong><small>{me?.email}</small></span><ChevronDown size={15} /></button>
          </div>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          {!sidebar && <button className="icon-button" onClick={() => setSidebar(true)} aria-label="Abrir menú"><PanelLeftClose size={17} className="flip" /></button>}
          <div className="crumb"><span>Upcoded CRM</span><ChevronRight size={14} /><strong>{section}</strong></div>
          <div className="top-actions"><button className="icon-button" aria-label={`${myTicketCount} pendientes`} onClick={() => setSection("Inicio")}><Bell size={18} /></button><span className="help-button"><Sparkles size={15} /> {me?.name}</span></div>
        </header>

        <div className="workspace">
          {notice && <div className="notice" role="status"><Check size={16} /><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Cerrar aviso"><X size={15} /></button></div>}
          {!hydrated ? <p className="loading-line">Cargando el CRM…</p>
            : section === "Inicio" ? <HomePanel {...panelProps} onNavigate={setSection} />
            : section === "Prospección" ? <ProspectingPanel {...panelProps} onSearch={launchSearch} />
            : section === "CRM" ? <CrmPanel {...panelProps} />
            : section === "Mensajes" ? <MessagesPanel {...panelProps} composeId={composeId} onComposeChange={setComposeId} />
            : <SettingsPanel {...panelProps} services={services} onSaveSettings={saveSettings} onSaveProfile={saveProfile} onSwitchAccount={switchAccount} canSwitchLocally={!isSupabaseConfigured} />}
        </div>
      </section>

      <nav className="mobile-nav" aria-label="Navegación principal">
        {nav.map(({ label, icon: Icon }) => {
          const badge = badgeFor(label);
          return <button key={label} className={section === label ? "active" : ""} onClick={() => setSection(label)} aria-current={section === label ? "page" : undefined}><Icon size={19} />{badge > 0 && <b>{badge}</b>}<span>{label === "Configuración" ? "Ajustes" : label}</span></button>;
        })}
      </nav>

      {drawerLead && <ProspectDrawer {...panelProps} lead={drawerLead} onClose={() => setDrawerId(undefined)} />}
    </main>
  );
}
