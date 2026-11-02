import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { PIPELINE_STAGES, relativeDue, stageLabel, type Lead, type Stage, type TeamMember } from "@/lib/crm";
import { Avatar, StageBadge } from "@/app/components/ui";

type Drag = { id: string; startX: number; startY: number; offsetX: number; offsetY: number; width: number; active: boolean };

const DRAG_THRESHOLD = 6;
const EDGE = 80;
const MAX_SPEED = 22;

/**
 * Tablero por etapa con arrastre por puntero (mouse o dedo): la tarjeta sigue al cursor,
 * el tablero se desplaza solo al acercarse a los bordes y se suelta en cualquier columna.
 */
export function KanbanBoard({ leads, team, now, onOpen, onMove }: { leads: Lead[]; team: TeamMember[]; now: number; onOpen: (id: string) => void; onMove: (id: string, stage: Stage) => void }) {
  const boardRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | undefined>(undefined);
  const pointer = useRef({ x: 0, y: 0 });
  const suppressClick = useRef(false);
  const [ghost, setGhost] = useState<{ id: string; x: number; y: number; width: number }>();
  const [over, setOver] = useState<Stage>();

  // Desplazamiento automático continuo mientras la tarjeta está cerca de un borde.
  useEffect(() => {
    if (!ghost) return;
    let frame = 0;
    const tick = () => {
      const board = boardRef.current;
      if (board) {
        const rect = board.getBoundingClientRect();
        const { x } = pointer.current;
        if (x < rect.left + EDGE) board.scrollLeft -= MAX_SPEED * Math.min(1, (rect.left + EDGE - x) / EDGE);
        else if (x > rect.right - EDGE) board.scrollLeft += MAX_SPEED * Math.min(1, (x - (rect.right - EDGE)) / EDGE);
        setOver(stageAt(pointer.current.x, pointer.current.y));
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ghost?.id]);

  function stageAt(x: number, y: number) {
    const element = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-stage]");
    return element?.dataset.stage as Stage | undefined;
  }

  function onPointerDown(event: ReactPointerEvent<HTMLButtonElement>, id: string) {
    if (event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    drag.current = { id, startX: event.clientX, startY: event.clientY, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top, width: rect.width, active: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const current = drag.current;
    if (!current) return;
    pointer.current = { x: event.clientX, y: event.clientY };
    if (!current.active && Math.hypot(event.clientX - current.startX, event.clientY - current.startY) < DRAG_THRESHOLD) return;
    current.active = true;
    setGhost({ id: current.id, x: event.clientX - current.offsetX, y: event.clientY - current.offsetY, width: current.width });
  }

  function finish(event: ReactPointerEvent<HTMLButtonElement>, cancelled: boolean) {
    const current = drag.current;
    drag.current = undefined;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!current?.active) return;
    // El click que sigue al soltar no debe abrir la ficha; si el navegador no lo dispara, se libera igual.
    suppressClick.current = true;
    window.setTimeout(() => { suppressClick.current = false; }, 0);
    const target = cancelled ? undefined : stageAt(event.clientX, event.clientY);
    setGhost(undefined);
    setOver(undefined);
    if (target) onMove(current.id, target);
  }

  const dragged = ghost ? leads.find((lead) => lead.id === ghost.id) : undefined;

  return (
    <>
      <div ref={boardRef} className={ghost ? "kanban dragging" : "kanban"} aria-label="Tablero por etapa">
        {PIPELINE_STAGES.map((column) => {
          const cards = leads.filter((lead) => lead.state === column);
          return <section key={column} data-stage={column} className={over === column ? "kanban-column over" : "kanban-column"} aria-label={stageLabel[column]}>
            <header><StageBadge stage={column} /><b>{cards.length}</b></header>
            {cards.map((lead) => <button key={lead.id} className={ghost?.id === lead.id ? "kanban-card placeholder" : "kanban-card"}
              onPointerDown={(event) => onPointerDown(event, lead.id)} onPointerMove={onPointerMove}
              onPointerUp={(event) => finish(event, false)} onPointerCancel={(event) => finish(event, true)}
              onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } onOpen(lead.id); }}>
              <CardBody lead={lead} team={team} now={now} />
            </button>)}
          </section>;
        })}
      </div>
      {ghost && dragged && <div className="kanban-card ghost" style={{ left: ghost.x, top: ghost.y, width: ghost.width }} aria-hidden="true"><CardBody lead={dragged} team={team} now={now} /></div>}
    </>
  );
}

function CardBody({ lead, team, now }: { lead: Lead; team: TeamMember[]; now: number }) {
  const overdue = lead.nextFollowUpAt && Date.parse(lead.nextFollowUpAt) < now && ["contactado", "respondio", "reunion"].includes(lead.state);
  return <>
    <strong>{lead.name}</strong>
    <small>{lead.category} · {lead.province || lead.location}</small>
    <span><Avatar member={team.find((member) => member.email === lead.assignedTo)} size="sm" /><i className={overdue ? "cell-due overdue" : "cell-due"}>{lead.nextFollowUpAt ? relativeDue(lead.nextFollowUpAt, now) : ""}</i><b>{lead.score}</b></span>
  </>;
}
