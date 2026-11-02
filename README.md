# Upcoded CRM

CRM privado para prospección verificable de Upcoded. El diseño toma la identidad de [Upcoded](https://upcoded.dev/es): interfaz oscura, precisión técnica y acento turquesa.

## Ejecutar localmente

```powershell
pnpm install
pnpm dev
```

Abrí `http://localhost:3000`.

## Activar datos reales sin costo

1. Creá un proyecto gratuito en Supabase y ejecutá, en este orden, [`supabase/schema.sql`](./supabase/schema.sql), [`supabase/002_production.sql`](./supabase/002_production.sql) y [`supabase/003_team.sql`](./supabase/003_team.sql) en el SQL Editor.
2. Copiá `.env.example` a `.env.local` y completá las claves públicas de Supabase.
3. En Supabase Auth, activá Google. Sólo entran los emails de `public.team_members` (por defecto `juanignaciogonzalez.ca@gmail.com` y `jpgarciamallorquin@gmail.com`).
4. Creá una clave gratuita de Tavily y cargala en `TAVILY_API_KEY` (opcional: la fuente principal es el mapa).

## Búsqueda de prospectos

1. **OpenStreetMap** (gratis, sin clave): negocios reales del rubro en la provincia o alrededor de la zona, con teléfono, web y redes cuando están cargados en el mapa. El servidor público de Overpass a veces tarda; la consulta tiene un límite de 25 s.
2. **Tavily** completa si el mapa trae pocos, descartando notas, rankings y directorios.
3. Antes de cargar, cada negocio se compara con todo el CRM (nombre + provincia, dominio, teléfono). Si ya está, no se duplica y el aviso dice quién lo lleva.
4. La auditoría del sitio revisa HTTPS, respuesta, móvil, SEO y contacto, y extrae teléfono/WhatsApp y email publicados. Si el sitio bloquea al bot (401/403/429/503) no se audita ni se informa como caído.

Si ninguna fuente responde, la búsqueda se detiene: la app no fabrica negocios ni afirma que una empresa no tiene web. Cada resultado vence a las 24 horas si nadie lo guarda.

## Tests

```powershell
pnpm test
```

## Límites de producto incluidos

- Prospectos nuevos: vencimiento de 24 horas; los guardados no vencen.
- No hay envío automático de mensajes.
- Las señales de redes sociales nunca se convierten por sí solas en “no tiene web”.
- El CRM es compartido entre los miembros del equipo; cada prospecto tiene un responsable y cada mensaje registra quién lo envió.
- Sin Supabase, la app corre en modo local (localStorage) y permite alternar entre perfiles desde el menú de cuenta.
