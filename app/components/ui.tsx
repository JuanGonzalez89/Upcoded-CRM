import { stageLabel, stageTone, type Lead, type LeadPatch, type Settings, type Stage, type TeamMember } from "@/lib/crm";

export type Section = "Inicio" | "Prospección" | "CRM" | "Mensajes" | "Configuración";

export type PanelProps = {
  leads: Lead[];
  team: TeamMember[];
  me: TeamMember;
  now: number;
  settings: Settings;
  onOpen: (id: string) => void;
  onUpdate: (id: string, patch: LeadPatch, message?: string) => Promise<boolean>;
  onCompose: (id: string) => void;
  onAnalyze: (id: string) => Promise<boolean>;
};

export function Avatar({ member, size = "md" }: { member?: TeamMember; size?: "sm" | "md" }) {
  if (!member) return <span className={`avatar ${size} empty`} title="Sin asignar">—</span>;
  const tone = [...member.email].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 2 ? "b" : "a";
  return <span className={`avatar ${size} tone-${tone}`} title={member.name}>{member.initials}</span>;
}

export function StageBadge({ stage }: { stage: Stage }) {
  return <em className={`state ${stageTone[stage]}`}>{stageLabel[stage]}</em>;
}

export function AssigneeSelect({ lead, team, onUpdate, compact }: { lead: Lead; team: TeamMember[]; onUpdate: PanelProps["onUpdate"]; compact?: boolean }) {
  return (
    <select className={compact ? "inline-select compact" : "inline-select"} aria-label={`Responsable de ${lead.name}`} value={lead.assignedTo ?? ""}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      onChange={(event) => { const value = event.target.value || null; onUpdate(lead.id, { assignedTo: value }, value ? `Asignado a ${team.find((member) => member.email === value)?.name}.` : "Prospecto sin responsable."); }}>
      <option value="">Sin asignar</option>
      {team.map((member) => <option key={member.email} value={member.email}>{member.name}</option>)}
    </select>
  );
}
