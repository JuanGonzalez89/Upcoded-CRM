import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { auditMapListing, extractContacts, identityKeys, isEditorialOrDirectory } from "./prospecting.ts";
import { buildOverpassQuery, NICHE_OSM_TAGS, provinceIso, toBusiness } from "./osm.ts";

describe("isEditorialOrDirectory", () => {
  test("descarta rankings, notas y portales", () => {
    assert.ok(isEditorialOrDirectory("#TOP10 Cafeterías CABA : @vedra.cafe", "https://www.instagram.com/p/xyz"));
    assert.ok(isEditorialOrDirectory("Las 15 mejores inmobiliarias de Córdoba", "https://blog.ejemplo.com"));
    assert.ok(isEditorialOrDirectory("Odontólogos en Palermo", "https://www.doctoralia.com.ar/odontologo/palermo"));
    assert.ok(isEditorialOrDirectory("Mecánica Integral", "https://www.tripadvisor.com.ar/x"));
  });

  test("conserva el sitio o perfil del propio negocio", () => {
    assert.ok(!isEditorialOrDirectory("KEK pastelería & co.", "https://www.instagram.com/kekpasteleria"));
    assert.ok(!isEditorialOrDirectory("Estudio Jurídico Pérez", "https://estudioperez.com.ar"));
  });

  test("descarta notas con título genérico pero URL de listado (portales tipo Timeout)", () => {
    assert.ok(isEditorialOrDirectory("comer y beber", "https://www.timeout.com/es/buenos-aires/comer-y-beber"));
    assert.ok(isEditorialOrDirectory("cafe de especialidad", "https://www.timeout.com/es/buenos-aires/mejores-cafeterias-de-especialidad"));
    assert.ok(isEditorialOrDirectory("Atracciones turísticas con los mejores cafés de Buenos Aires", "https://all.accor.com/a/es/limitless/thematics/shopping/mejores-cafes-buenos-aires.html"));
  });

  test("descarta la bio de quien escribió la nota, no es un negocio", () => {
    assert.ok(isEditorialOrDirectory("sol mohadeb", "https://www.timeout.com/profile/sol-mohadeb"));
  });

  test("detecta el listado por el slug de la URL aunque el título no tenga palabras clave", () => {
    assert.ok(isEditorialOrDirectory("cafeteria con niños", "https://misitio.com/notas/mejores-cafes-de-especialidad-para-ir-con-chicos"));
  });
});

describe("identityKeys", () => {
  test("reconoce el mismo negocio por nombre (sin tildes), dominio o teléfono", () => {
    const a = identityKeys({ name: "Clínica Dental Sur", province: "Córdoba", websiteUrl: "https://www.dentalsur.com.ar/turnos", phone: "0351 15-612-3456" });
    const byName = identityKeys({ name: "clinica dental sur", province: "Cordoba" });
    const byDomain = identityKeys({ name: "Otro nombre", province: "Salta", websiteUrl: "http://dentalsur.com.ar" });
    const byPhone = identityKeys({ name: "Otro", province: "Salta", phone: "+54 9 351 612-3456" });
    for (const other of [byName, byDomain, byPhone]) assert.ok(other.some((key) => a.includes(key)), other.join());
  });

  test("el mismo nombre en otra provincia no es duplicado", () => {
    const a = identityKeys({ name: "Mecánica Integral", province: "Córdoba" });
    const b = identityKeys({ name: "Mecánica Integral", province: "Mendoza" });
    assert.ok(!b.some((key) => a.includes(key)));
  });

  test("redes sociales no cuentan como dominio propio", () => {
    assert.ok(!identityKeys({ name: "X", websiteUrl: "https://www.instagram.com/negocio" }).some((key) => key.startsWith("d:")));
  });
});

describe("extractContacts", () => {
  test("prioriza WhatsApp, toma tel: y emails reales", () => {
    const html = `<a href="tel:+54 351 612-3456">Llamar</a><a href="https://wa.me/5493516123456">WA</a><a href="mailto:info@example.com">x</a><a href="mailto:Turnos@DentalSur.com.ar?subject=hola">Turnos</a>`;
    assert.deepEqual(extractContacts(html), { phone: "+5493516123456", email: "turnos@dentalsur.com.ar" });
  });

  test("sin contactos devuelve vacío", () => {
    assert.deepEqual(extractContacts("<p>Hola</p>"), { phone: undefined, email: undefined });
  });
});

describe("auditMapListing", () => {
  test("sin web en el mapa: oportunidad alta pero con revisión manual, nunca 'no tiene web'", () => {
    const audit = auditMapListing({ name: "Taller Norte", osmId: "node/1", phone: "011 4567-8901" });
    assert.equal(audit.webStatus, "No localizada");
    assert.ok(audit.manualReview);
    assert.ok(audit.signals.some((signal) => /No alcanza para afirmar/.test(signal)));
    assert.equal(audit.evidence[0].url, "https://www.openstreetmap.org/node/1");
  });
});

describe("OpenStreetMap", () => {
  test("todos los rubros del catálogo tienen etiquetas", () => {
    assert.equal(Object.keys(NICHE_OSM_TAGS).length, 16);
  });

  test("provincias por código ISO, con o sin tildes", () => {
    assert.equal(provinceIso("Ciudad Autónoma de Buenos Aires"), "AR-C");
    assert.equal(provinceIso("Buenos Aires"), "AR-B");
    assert.equal(provinceIso("Córdoba"), "AR-X");
    assert.equal(provinceIso("Tierra del Fuego, Antártida e Islas del Atlántico Sur"), "AR-V");
    assert.equal(provinceIso("Atlántida"), undefined);
  });

  test("arma la consulta por provincia o por radio", () => {
    assert.equal(buildOverpassQuery(['["amenity"="dentist"]'], { iso: "AR-X" }, 30), '[out:json][timeout:25];area["ISO3166-2"="AR-X"]->.prov;(nwr["amenity"="dentist"]["name"](area.prov););out center tags 30;');
    assert.match(buildOverpassQuery(['["shop"="car_repair"]'], { lat: -33.1, lon: -64.3, km: 12 }, 10), /\(-33\.2081,-64\.4291,-32\.9919,-64\.1709\)/);
  });

  test("normaliza contactos del lugar", () => {
    const place = toBusiness({ type: "node", id: 7, tags: { name: "Dental Sur", "contact:phone": "+54 351 612 3456; +54 351 600 0000", "contact:instagram": "@dentalsur", website: "https://dentalsur.com.ar" } });
    assert.deepEqual(place && { phone: place.phone, instagram: place.instagram, osmId: place.osmId }, { phone: "+54 351 612 3456", instagram: "https://www.instagram.com/dentalsur", osmId: "node/7" });
    assert.equal(toBusiness({ type: "node", id: 8, tags: { amenity: "dentist" } }), undefined);
  });
});
