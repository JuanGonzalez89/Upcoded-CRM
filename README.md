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
4. Creá una clave gratuita de Tavily y cargala en `TAVILY_API_KEY`.

Sin `TAVILY_API_KEY`, el endpoint de prospección se detiene explícitamente: no fabrica negocios ni afirma que una empresa no tiene web. Con la clave, busca resultados, conserva el enlace fuente, calcula puntuación separada de confianza y marca los casos ambiguos para revisión. Cada resultado se guarda en Supabase, recibe vencimiento de 24 horas y pasa por una auditoría básica de URL, HTTPS, respuesta, móvil, SEO, contacto e Instagram enlazado desde el propio sitio.

## Límites de producto incluidos

- Prospectos nuevos: vencimiento de 24 horas; los guardados no vencen.
- No hay envío automático de mensajes.
- Las señales de redes sociales nunca se convierten por sí solas en “no tiene web”.
- El CRM es compartido entre los miembros del equipo; cada prospecto tiene un responsable y cada mensaje registra quién lo envió.
- Sin Supabase, la app corre en modo local (localStorage) y permite alternar entre perfiles desde el menú de cuenta.
