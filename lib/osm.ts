// Negocios reales desde OpenStreetMap (Overpass API, gratuita). Cada resultado es un lugar
// cargado en el mapa con nombre propio, a diferencia de un buscador web que devuelve notas y rankings.

export type OsmBusiness = {
  osmId: string;
  name: string;
  website?: string;
  phone?: string;
  email?: string;
  instagram?: string;
  address?: string;
  city?: string;
};

// Etiquetas OSM por rubro del catálogo de Prospección.
export const NICHE_OSM_TAGS: Record<string, string[]> = {
  "Consultorios odontológicos": ['["amenity"="dentist"]', '["healthcare"="dentist"]'],
  "Centros de estética y medicina estética": ['["shop"="beauty"]', '["healthcare"="cosmetic"]'],
  "Salones de eventos": ['["amenity"="events_venue"]'],
  "Inmobiliarias": ['["office"="estate_agent"]'],
  "Estudios jurídicos": ['["office"="lawyer"]'],
  "Kinesiología y fisioterapia": ['["healthcare"="physiotherapist"]'],
  "Constructoras y arquitectura": ['["office"="architect"]', '["craft"="builder"]'],
  "Veterinarias": ['["amenity"="veterinary"]'],
  "Gimnasios y estudios de entrenamiento": ['["leisure"="fitness_centre"]'],
  "Institutos educativos": ['["amenity"="language_school"]', '["amenity"="training"]', '["amenity"="music_school"]', '["amenity"="driving_school"]'],
  "Psicología y salud mental": ['["healthcare"="psychotherapist"]', '["healthcare"="psychologist"]'],
  "Restaurantes y cafeterías": ['["amenity"="restaurant"]', '["amenity"="cafe"]'],
  "Talleres mecánicos": ['["shop"="car_repair"]'],
  "Mueblerías y decoración": ['["shop"="furniture"]', '["shop"="interior_decoration"]'],
  "Contadores y estudios contables": ['["office"="accountant"]', '["office"="tax_advisor"]'],
  "Clínicas y centros médicos": ['["amenity"="clinic"]', '["amenity"="doctors"]', '["healthcare"="clinic"]'],
};

// Código ISO 3166-2 de cada provincia: más robusto que el nombre (tildes, nombres largos).
const PROVINCE_ISO: [RegExp, string][] = [
  [/^ciudad autonoma|^caba$/, "AR-C"], [/^buenos aires/, "AR-B"], [/^catamarca/, "AR-K"], [/^chaco/, "AR-H"],
  [/^chubut/, "AR-U"], [/^cordoba/, "AR-X"], [/^corrientes/, "AR-W"], [/^entre rios/, "AR-E"], [/^formosa/, "AR-P"],
  [/^jujuy/, "AR-Y"], [/^la pampa/, "AR-L"], [/^la rioja/, "AR-F"], [/^mendoza/, "AR-M"], [/^misiones/, "AR-N"],
  [/^neuquen/, "AR-Q"], [/^rio negro/, "AR-R"], [/^salta/, "AR-A"], [/^san juan/, "AR-J"], [/^san luis/, "AR-D"],
  [/^santa cruz/, "AR-Z"], [/^santa fe/, "AR-S"], [/^santiago del estero/, "AR-G"], [/^tierra del fuego/, "AR-V"], [/^tucuman/, "AR-T"],
];

const fold = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export function provinceIso(province: string) {
  const folded = fold(province);
  return PROVINCE_ISO.find(([pattern]) => pattern.test(folded))?.[1];
}

export function buildOverpassQuery(tags: string[], scope: { iso: string } | { lat: number; lon: number; km: number }, limit: number) {
  // Para una zona se usa un recuadro alrededor del centro: Overpass lo resuelve mucho más rápido que around:.
  const dLat = "km" in scope ? scope.km / 111 : 0;
  const dLon = "km" in scope ? scope.km / (111 * Math.cos((scope.lat * Math.PI) / 180)) : 0;
  const filter = "iso" in scope ? "(area.prov)" : `(${[scope.lat - dLat, scope.lon - dLon, scope.lat + dLat, scope.lon + dLon].map((value) => value.toFixed(4)).join(",")})`;
  const header = "iso" in scope ? `area["ISO3166-2"="${scope.iso}"]->.prov;` : "";
  return `[out:json][timeout:25];${header}(${tags.map((tag) => `nwr${tag}["name"]${filter};`).join("")});out center tags ${limit};`;
}

export function toBusiness(element: { type: string; id: number; tags?: Record<string, string> }): OsmBusiness | undefined {
  const tags = element.tags ?? {};
  if (!tags.name) return undefined;
  const pick = (...keys: string[]) => keys.map((key) => tags[key]?.split(";")[0].trim()).find(Boolean);
  const instagram = pick("contact:instagram", "instagram");
  return {
    osmId: `${element.type}/${element.id}`,
    name: tags.name,
    website: pick("website", "contact:website", "url"),
    phone: pick("contact:whatsapp", "phone", "contact:phone", "contact:mobile"),
    email: pick("email", "contact:email"),
    instagram: instagram && !instagram.startsWith("http") ? `https://www.instagram.com/${instagram.replace(/^@/, "")}` : instagram,
    address: [tags["addr:street"], tags["addr:housenumber"]].filter(Boolean).join(" ") || undefined,
    city: pick("addr:city", "addr:suburb", "addr:district"),
  };
}

const ENDPOINTS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter"];

type OverpassPayload = { elements?: { type: string; id: number; tags?: Record<string, string> }[] };

/** Consulta los servidores en paralelo y se queda con el primero que responda dentro del límite. */
async function runOverpass(query: string, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await Promise.any(ENDPOINTS.map(async (endpoint) => {
      const response = await fetch(endpoint, { method: "POST", body: new URLSearchParams({ data: query }), headers: { "User-Agent": "UpcodedCRM/1.0 (prospeccion interna)" }, signal: controller.signal, cache: "no-store" });
      if (!response.ok) throw new Error(`Overpass ${response.status}`);
      return await response.json() as OverpassPayload;
    }));
  } catch { return undefined; }
  finally { clearTimeout(timer); controller.abort(); }
}

async function localityCentroid(province: string, locality: string) {
  try {
    const url = `https://apis.datos.gob.ar/georef/api/municipios?provincia=${encodeURIComponent(province)}&nombre=${encodeURIComponent(locality)}&campos=centroide&max=1`;
    const payload = await (await fetch(url, { next: { revalidate: 604800 } })).json() as { municipios?: { centroide: { lat: number; lon: number } }[] };
    return payload.municipios?.[0]?.centroide;
  } catch { return undefined; }
}

/** Busca negocios del rubro en la provincia (o alrededor de la zona). Devuelve undefined si el rubro no tiene mapeo o Overpass no respondió. */
export async function findOsmBusinesses(input: { niche: string; province: string; area?: string; limit: number; timeoutMs?: number }) {
  const tags = NICHE_OSM_TAGS[input.niche];
  const iso = provinceIso(input.province);
  if (!tags || !iso) return undefined;
  const centroid = input.area ? await localityCentroid(input.province, input.area) : undefined;
  const scope = centroid ? { lat: centroid.lat, lon: centroid.lon, km: 12 } : { iso };
  // Se piden más de los necesarios para priorizar los que tienen algún canal de contacto.
  const payload = await runOverpass(buildOverpassQuery(tags, scope, input.limit * 4), input.timeoutMs ?? 25000);
  if (!payload) return undefined;
  const seen = new Set<string>();
  const businesses = (payload.elements ?? []).map(toBusiness).filter((item): item is OsmBusiness => {
    if (!item) return false;
    const key = fold(item.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const contactable = (item: OsmBusiness) => Number(Boolean(item.phone || item.email || item.instagram)) + Number(Boolean(item.website));
  return businesses.sort((a, b) => contactable(b) - contactable(a)).slice(0, input.limit);
}
