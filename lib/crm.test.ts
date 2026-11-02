import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { applyLocalPatch, buildTickets, DEFAULT_SETTINGS, DEFAULT_TEAM, outreachObservation, renderTemplate, whatsappLinks, type Lead } from "./crm.ts";

const JI = DEFAULT_TEAM[0].email;
const JP = DEFAULT_TEAM[1].email;
const HOUR = 60 * 60 * 1000;
const now = Date.now();

function lead(partial: Partial<Lead>): Lead {
  return { id: Math.random().toString(36).slice(2), name: "Clínica Sur", category: "Clínicas", province: "Córdoba", locality: "", location: "Córdoba", state: "nuevo", score: 85, confidence: 80, site: "Con fricción", signals: ["No se detectó etiqueta viewport para móvil"], evidence: [], phone: "", email: "", notes: "", createdAt: "", activity: [], messages: [], ...partial };
}

describe("buildTickets", () => {
  const leads = [
    lead({ id: "a", state: "guardado" }),
    lead({ id: "b", state: "guardado", assignedTo: JI }),
    lead({ id: "c", state: "guardado", assignedTo: JP }),
    lead({ id: "d", state: "contactado", assignedTo: JI, nextFollowUpAt: new Date(now - 24 * HOUR).toISOString() }),
    lead({ id: "e", state: "contactado", assignedTo: JI, nextFollowUpAt: new Date(now + 72 * HOUR).toISOString() }),
    lead({ id: "f", state: "respondio", assignedTo: JP }),
    lead({ id: "g", state: "nuevo", expiresAt: now + 2 * HOUR }),
    lead({ id: "h", state: "cliente", assignedTo: JI }),
  ];

  test("mis pendientes: sólo lo mío y lo que no tiene responsable, por urgencia", () => {
    assert.deepEqual(buildTickets(leads, JI, "mios", now).map((t) => `${t.lead.id}:${t.kind}`), ["d:seguimiento", "a:sin_asignar", "b:por_contactar", "g:por_vencer"]);
  });

  test("equipo: incluye lo del otro miembro y excluye seguimientos futuros y clientes", () => {
    const team = buildTickets(leads, JI, "equipo", now);
    assert.ok(team.some((t) => t.lead.id === "f" && t.kind === "respondio"));
    assert.ok(team.some((t) => t.lead.id === "c"));
    assert.ok(!team.some((t) => t.lead.id === "e" || t.lead.id === "h"));
  });
});

describe("applyLocalPatch", () => {
  test("guardar asigna a quien guarda y quita el vencimiento", () => {
    const saved = applyLocalPatch(lead({ expiresAt: now + HOUR }), { state: "guardado" }, JP, DEFAULT_TEAM, DEFAULT_SETTINGS);
    assert.equal(saved.assignedTo, JP);
    assert.equal(saved.expiresAt, undefined);
    assert.equal(saved.activity[0].kind, "estado");
  });

  test("registrar contacto pasa a Contactado y programa el seguimiento", () => {
    const contacted = applyLocalPatch(lead({ state: "guardado", assignedTo: JP }), { contact: { channel: "whatsapp", body: "hola" } }, JP, DEFAULT_TEAM, DEFAULT_SETTINGS);
    assert.equal(contacted.state, "contactado");
    assert.equal(contacted.lastContactedBy, JP);
    assert.equal(contacted.messages.length, 1);
    assert.ok(Math.abs(Date.parse(contacted.nextFollowUpAt!) - (now + DEFAULT_SETTINGS.followUpDays * 24 * HOUR)) < 60_000);
  });

  test("un contacto nuevo no retrocede a quien ya respondió", () => {
    const replied = applyLocalPatch(lead({ state: "respondio" }), { contact: { channel: "email", body: "x" } }, JI, DEFAULT_TEAM, DEFAULT_SETTINGS);
    assert.equal(replied.state, "respondio");
  });

  test("reasignar deja registro con el nombre del miembro", () => {
    const reassigned = applyLocalPatch(lead({ assignedTo: JP }), { assignedTo: JI }, JP, DEFAULT_TEAM, DEFAULT_SETTINGS);
    assert.equal(reassigned.assignedTo, JI);
    assert.match(reassigned.activity[0].body, /Juan Ignacio/);
  });
});

describe("mensajes", () => {
  test("la plantilla no deja variables sin reemplazar", () => {
    const message = renderTemplate(DEFAULT_SETTINGS.templates.whatsapp, lead({ locality: "Río Cuarto" }), DEFAULT_TEAM[1], DEFAULT_SETTINGS);
    assert.doesNotMatch(message, /\{\w+\}/);
    assert.match(message, /JP García/);
    assert.match(message, /no se adapta bien al celular/);
    assert.match(message, /Río Cuarto/);
  });

  test("las plantillas por defecto no usan 'sin compromiso'", () => {
    assert.doesNotMatch(Object.values(DEFAULT_SETTINGS.templates).join(" "), /sin compromiso/i);
  });

  test("las notas internas del buscador nunca llegan al cliente", () => {
    const fallback = "hay margen para que las consultas les lleguen más fácil";
    assert.equal(outreachObservation(lead({ signals: ["No se localizó un sitio en este resultado", "Revisión manual recomendada"] })), fallback);
    assert.equal(outreachObservation(lead({ signals: ["Se encontró una red social"] })), fallback);
    assert.equal(outreachObservation(lead({ signals: ["No se pudo cargar el sitio para auditarlo"] })), fallback);
  });

  test("un bloqueo anti-bots no se presenta como web caída", () => {
    assert.doesNotMatch(outreachObservation(lead({ signals: ["El sitio bloqueó la auditoría automática (estado 403): revisar a mano"] })), /error/);
    assert.doesNotMatch(outreachObservation(lead({ signals: ["El sitio respondió con estado 403"] })), /error/);
    assert.match(outreachObservation(lead({ signals: ["El sitio respondió con estado 503"] })), /error al abrirla/);
  });

  test("lento en móvil se describe como lentitud, no como falta de adaptación", () => {
    assert.match(outreachObservation(lead({ signals: ["Sitio lento en móvil"] })), /tarda/);
  });

  test("las observaciones no hablan en primera persona singular", () => {
    for (const signal of ["El sitio respondió con estado 500", "No se detectó etiqueta viewport para móvil", "Respuesta lenta: 5 s", "El sitio no usa HTTPS", "Meta descripción no detectada", "No se detectó formulario ni canal de contacto directo"]) {
      assert.doesNotMatch(outreachObservation(lead({ signals: [signal] })), /\b(revisé|vi|noté|miré)\b/);
    }
  });
});

describe("whatsappLinks", () => {
  const numbers = (phone: string) => whatsappLinks(phone, "a").links.map((item) => item.url.split("?")[0].replace("https://wa.me/", ""));

  test("celulares con 15 o con 9 internacional: un solo link móvil", () => {
    assert.deepEqual(numbers("0221 15 459-1020"), ["5492214591020"]);
    assert.deepEqual(numbers("011 15 5555-1234"), ["5491155551234"]);
    assert.deepEqual(numbers("(0351) 15-612-3456"), ["5493516123456"]);
    assert.deepEqual(numbers("02954 15 123456"), ["5492954123456"]);
    assert.deepEqual(numbers("+54 9 351 612 3456"), ["5493516123456"]);
  });

  test("sin marca de celular: ofrece celular y fijo", () => {
    assert.deepEqual(numbers("011 4567-8901"), ["5491145678901", "541145678901"]);
    assert.deepEqual(numbers("11 5555 1234"), ["5491155551234", "541155551234"]);
  });

  test("números extranjeros pasan sin tocar", () => {
    assert.deepEqual(numbers("+1 415 555 0101"), ["14155550101"]);
    assert.deepEqual(numbers("+598 99 123 456"), ["59899123456"]);
  });

  test("números incompletos, múltiples, con interno o 0800 no generan link", () => {
    for (const phone of ["15 4567-8901", "4567-8901", "011 4567-8901 / 4567-8902", "011 4567-8901 int 23", "0800 222 1234", "4567-890"]) {
      const result = whatsappLinks(phone, "a");
      assert.deepEqual(result.links, [], phone);
      assert.ok(result.problem && !/Cargá un teléfono/.test(result.problem), phone);
    }
    assert.match(whatsappLinks("", "a").problem!, /Cargá un teléfono/);
  });
});

describe("sin respuesta", () => {
  test("tras 3 contactos y con el seguimiento vencido sugiere cerrar como Perdido", () => {
    const messages = [1, 2, 3].map((n) => ({ id: String(n), channel: "whatsapp", body: "x", actor: JI, at: new Date(now - n * 24 * HOUR).toISOString() }));
    const overdue = new Date(now - HOUR).toISOString();
    assert.equal(buildTickets([lead({ state: "contactado", assignedTo: JI, messages, nextFollowUpAt: overdue })], JI, "mios", now)[0].kind, "sin_respuesta");
    assert.equal(buildTickets([lead({ state: "contactado", assignedTo: JI, messages: messages.slice(0, 2), nextFollowUpAt: overdue })], JI, "mios", now)[0].kind, "seguimiento");
  });
});
