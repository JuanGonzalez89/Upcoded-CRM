import { NextResponse } from "next/server";

type GeoItem = { id: string; nombre: string };

export async function GET(request: Request) {
  const province = new URL(request.url).searchParams.get("province");
  const endpoint = province
    ? `https://apis.datos.gob.ar/georef/api/municipios?provincia=${encodeURIComponent(province)}&campos=id,nombre&max=5000`
    : "https://apis.datos.gob.ar/georef/api/provincias?campos=id,nombre&max=500";
  try {
    const response = await fetch(endpoint, { next: { revalidate: 604800 } });
    if (!response.ok) throw new Error("GeoRef unavailable");
    const payload = await response.json() as { provincias?: GeoItem[]; municipios?: GeoItem[] };
    const items = (payload.provincias ?? payload.municipios ?? []).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [], warning: "GeoRef no respondió; se mantienen las sugerencias locales." }, { status: 200 });
  }
}
