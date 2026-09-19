# Plan de acción — Upcoded CRM

## 1. Decisión de producto

Construir una aplicación web privada para operar Upcoded. El MVP se concentra en prospección y CRM; las áreas de clientes, proyectos y propuestas se incorporan sobre la misma base sin frenar el lanzamiento inicial.

El sistema tendrá dos espacios de datos separados:

- **Bandeja temporal:** resultados nuevos, con cuenta regresiva de 24 horas.
- **CRM permanente:** prospectos guardados, contactados o convertidos.

## 2. Navegación recomendada

### MVP

1. **Inicio**
   - Estado de búsquedas activas.
   - Prospectos por vencer.
   - Prospectos guardados esta semana.
   - Embudo comercial resumido.
   - Alertas de cuotas, fuentes caídas y datos que requieren revisión.

2. **Prospección**
   - Nueva búsqueda.
   - Bandeja 24 h.
   - Búsquedas e historial.
   - Revisión de evidencia.
   - Prospectos descartados durante la ventana temporal.

3. **CRM**
   - Vista de tabla y kanban.
   - Etapas: Guardado, Por contactar, Contactado, Respondió, Reunión, Propuesta, Negociación, Ganado, Perdido y No contactar.
   - Actividad, notas, recordatorios y siguiente acción.

4. **Mensajes**
   - Borradores personalizados por evidencia.
   - Variantes para WhatsApp, email e Instagram.
   - Plantillas de voz Upcoded.
   - Historial de mensajes copiados o enviados manualmente.

5. **Configuración**
   - Cuenta autorizada.
   - Servicios de Upcoded.
   - Voz y reglas de mensajes.
   - Pesos del scoring.
   - Fuentes y cuotas gratuitas.
   - Nichos y sinónimos.

### Segunda etapa

6. **Clientes**
   - Datos comerciales, contactos, servicios contratados y documentación.

7. **Proyectos**
   - Estado, hitos, entregables, fechas y enlaces relevantes.

8. **Propuestas**
   - Presupuestos, alcance, versión, vencimiento y estado de aceptación.

### Tercera etapa

9. **Agenda**
   - Reuniones y seguimientos.

10. **Métricas**
    - Respuesta por nicho, fuente, ubicación y tipo de problema.
    - Conversión entre etapas.
    - Calidad real del scoring frente a resultados comerciales.

No se recomienda construir facturación, contabilidad ni gestión completa de tareas en el MVP. Esas áreas desviarían el producto de su ventaja principal: encontrar y convertir oportunidades confiables.

## 3. Constructor de búsqueda

La pantalla de nueva búsqueda funcionará como un formulario progresivo:

1. **Qué buscar**
   - Categoría principal: Salud, Eventos, Inmobiliarias, Gastronomía, Servicios profesionales, Comercios, Automotor, Educación, Turismo u Otra.
   - Nicho: selector con búsqueda y sinónimos.
   - Texto personalizado opcional.

2. **Dónde buscar**
   - País: Argentina por defecto.
   - Provincia o jurisdicción.
   - División intermedia adaptativa.
   - Localidad o ciudad.
   - Barrio cuando exista una fuente oficial.
   - Posibilidad de agregar varias ubicaciones como chips independientes.

Ejemplos válidos:

- `Argentina / CABA / Recoleta`
- `Argentina / CABA / Palermo`
- `Argentina / Buenos Aires / Vicente López / Olivos`
- `Argentina / Buenos Aires / San Isidro / Martínez`

Jerarquías:

- **CABA:** País → Jurisdicción → Comuna opcional → Barrio.
- **Provincia de Buenos Aires:** País → Provincia → Partido → Localidad → barrio opcional/manual.
- **Otras provincias:** País → Provincia → Departamento/Municipio → Localidad.

La app no utilizará Nominatim para autocompletado: su política pública lo prohíbe. Se precargarán y cachearán las divisiones oficiales de GeoRef y datasets oficiales de barrios.

3. **Cantidad y frescura**
   - Cantidad objetivo: 10, 20, 30 o 50.
   - Ventana temporal: 24 horas en el MVP.
   - Botón `Buscar prospectos` con estimación de consumo de cuota gratuita.

## 4. Pipeline de prospección

1. Convertir nicho y ubicación en consultas controladas.
2. Buscar candidatos con Tavily dentro de su cuota gratuita.
3. Normalizar nombre, teléfono, dominio, dirección y redes.
4. Deduplicar por dominio, teléfono, dirección y similitud de nombre.
5. Resolver la identidad del negocio.
6. Localizar su web sin inventar dominios.
7. Buscar redes y enlaces publicados por el propio negocio.
8. Auditar la web.
9. Guardar cada afirmación con fuente, fecha, método y confianza.
10. Calcular oportunidad, confianza y contactabilidad por separado.
11. Mostrar el prospecto en la bandeja de 24 horas.

### Regla de identidad

Un negocio queda **Verificado** cuando coinciden al menos dos señales fuertes entre fuentes: teléfono, dirección, dominio oficial o perfil social enlazado. Con una sola señal pasa a **Revisión manual**. Si hay contradicciones queda **Conflicto de identidad** y no recibe mensaje.

### Regla de “sin web”

Nunca se afirmará que un negocio no tiene web. Los estados posibles son:

- Web confirmada.
- Web caída o inaccesible al verificar.
- Web no localizada después de revisar las fuentes disponibles.
- Revisión manual necesaria por red social o bio inaccesible.

Solo `Web no localizada` con confianza alta puede alimentar una propuesta de sitio nuevo.

## 5. Auditoría de presencia digital

### Señales técnicas

- Estado HTTP y redirecciones.
- HTTPS y certificado.
- Meta viewport.
- Título y descripción.
- Encabezados, enlaces rotos y errores visibles.
- WhatsApp, teléfono, formulario y redes enlazadas.
- Rendimiento mediante PageSpeed Insights cuando haya cuota.

### Señales comerciales

- Propuesta de valor visible.
- Servicio y ubicación comprensibles.
- CTA principal claro.
- Contacto realizable desde móvil.
- Información vigente.
- Confianza visual y contenido suficiente.
- Fricción en reservas, turnos o consultas.

Los hallazgos técnicos menores no deben convertir por sí solos una buena web en oportunidad comercial.

## 6. Modelo de puntuación

No habrá un número opaco único. Cada prospecto mostrará:

- **Confianza de verificación (0–100):** certeza sobre identidad y evidencias.
- **Oportunidad web (0–100):** magnitud del problema comercial/digital.
- **Contactabilidad (0–100):** existencia y calidad de canales de contacto.
- **Prioridad:** Alta, Media, Baja, Revisar o No contactar.

Distribución inicial de oportunidad:

- Ausencia o caída confirmada de la web: 30 puntos.
- Fricción de conversión/contacto: 25 puntos.
- Experiencia móvil y claridad: 20 puntos.
- Confianza, mantenimiento y errores: 15 puntos.
- Descubrimiento local y contenido: 10 puntos.

Reglas duras:

- Confianza menor a 75: `Revisar`, nunca contactar automáticamente.
- Web moderna y flujo comercial correcto: `No contactar`, aunque existan detalles SEO menores.
- Contacto no confirmado: se puede guardar, pero no generar enlace de envío.

## 7. Ficha del prospecto

Cada ficha tendrá:

- Identidad y ubicación.
- Cuenta regresiva hasta vencimiento.
- Tres puntuaciones separadas.
- Web y redes encontradas.
- Evidencias con enlaces y fecha.
- Problemas confirmados y observaciones inciertas separadas.
- Capturas móvil/escritorio cuando estén disponibles.
- Mensaje sugerido.
- Acciones: Guardar, Descartar, Marcar para revisar, Abrir web, Abrir Instagram y Copiar mensaje.

## 8. Mensajes de Upcoded

La generación inicial será determinista, sin una API de IA paga. Utilizará bloques editoriales escritos para Upcoded:

1. Apertura humana y breve.
2. Observación verificable.
3. Consecuencia expresada como posibilidad, no como dato inventado.
4. Relación con un servicio real de Upcoded.
5. Pregunta pequeña y fácil de responder.

Prohibido:

- “Descubrí” repetido mecánicamente.
- “Gratis y sin compromiso” en todos los mensajes.
- Afirmar pérdidas de clientes sin datos.
- Criticar al negocio o llamar “mala” a su web.
- Usar un problema SEO menor como argumento de rediseño completo.

## 9. Retención de 24 horas

Estados que vencen: `nuevo`, `revisar` y `descartado temporal`.

Estados permanentes: `guardado`, `contactado`, `respondió`, `cliente`, `no contactar permanente`.

Cada prospecto temporal tendrá `expires_at`. Un proceso horario eliminará definitivamente los vencidos y sus evidencias dependientes. Antes del vencimiento la interfaz mostrará avisos a las 6, 2 y 1 horas. Guardar un prospecto cancela inmediatamente su vencimiento.

## 10. Arquitectura técnica

- **Frontend:** Next.js + TypeScript, diseño responsive y accesible.
- **UI:** Tailwind CSS y componentes headless accesibles; tablas virtualizadas solo si el volumen lo requiere.
- **Hosting MVP:** Cloudflare Pages/Workers. Vercel Hobby queda excluido por su restricción de uso comercial.
- **Autenticación y datos:** Supabase Auth + PostgreSQL + Row Level Security.
- **Jobs:** Inngest Hobby para búsqueda por etapas, reintentos y trazabilidad.
- **Descubrimiento web:** Tavily Researcher, con límite interno y bloqueo al agotarse los créditos.
- **Geografía:** GeoRef Argentina y datasets oficiales locales cacheados.
- **Performance web:** PageSpeed Insights con o sin clave según cuota.
- **Fallback:** ejecución local completa para continuar usando el CRM si un servicio gratuito pausa el proyecto.

Tablas principales:

- `users`
- `campaigns`
- `campaign_locations`
- `prospects`
- `prospect_sources`
- `evidence`
- `website_audits`
- `outreach_drafts`
- `pipeline_events`
- `clients`
- `projects`
- `job_runs`
- `settings`

## 11. Seguridad

- OAuth de Google sin contraseña propia.
- Allowlist exacta del email verificado `upcodednow@gmail.com`.
- Comprobación de autorización en servidor y políticas RLS en todas las tablas.
- Ninguna clave secreta expuesta al navegador.
- Cron y webhooks protegidos por secretos e idempotencia.
- Validación estricta de entradas y URLs.
- Sin envío automático de mensajes en el MVP.

## 12. Dirección de interfaz

Modo de uso: **Operate**. Escritorio primero para revisar información densa, con las acciones esenciales disponibles en móvil.

Dirección recomendada: consola operativa de Upcoded, precisa y sobria. Hereda la personalidad técnica y directa de `upcoded.dev`, pero evita parecer una terminal decorativa.

- Barra lateral compacta.
- Fondo oscuro o neutro con superficies planas.
- Un color de acción Upcoded y colores semánticos accesibles.
- Tipografía sans legible; monoespaciada solo para dominios, métricas y evidencia técnica.
- Sin gradientes ornamentales, glassmorphism ni tarjetas repetidas sin jerarquía.
- Animación mínima: progreso, aparición de resultados y cambio de estados.
- Tabla densa en escritorio; fichas compactas en móvil.

La pantalla protagonista será Prospección: constructor de búsqueda a la izquierda, progreso verificable durante el trabajo y bandeja de resultados con detalle lateral.

## 13. Fases de implementación

### Fase 0 — Base del producto

- Renombrar la carpeta a `Upcoded CRM` una vez cerrada la tarea que la bloquea.
- Crear repositorio Git.
- Inicializar Next.js/TypeScript.
- Configurar variables y entornos.
- Definir esquema SQL y políticas RLS.

### Fase 1 — Acceso y shell

- Login Google.
- Allowlist del único administrador.
- Navegación, layout y estados vacíos.
- Configuración de fuentes y cuotas.

### Fase 2 — Ubicaciones y campañas

- Importar GeoRef.
- Incorporar barrios de CABA.
- Crear selector jerárquico y multiubicación.
- Crear nichos, sinónimos y formulario de búsqueda.

### Fase 3 — Descubrimiento confiable

- Integrar Tavily.
- Jobs con reintentos.
- Normalización, deduplicación y resolución de identidad.
- Evidencias y niveles de confianza.

### Fase 4 — Auditoría y scoring

- Auditor técnico y comercial.
- PageSpeed opcional.
- Tres puntuaciones y reglas duras.
- Estados Revisar y No contactar.

### Fase 5 — Bandeja 24 h y CRM

- Cuenta regresiva y limpieza horaria.
- Guardado permanente.
- Tabla, kanban, notas y actividad.

### Fase 6 — Mensajes

- Motor editorial basado en evidencia.
- Variantes por canal.
- Copiado y registro manual de actividad.

### Fase 7 — QA y migración

- Migrar los JSON históricos como datos de prueba marcados como desactualizados.
- Validar manualmente al menos 30 prospectos de tres nichos.
- Medir falsos positivos, webs omitidas y negocios no existentes.
- Ajustar reglas antes de usarlo comercialmente.

### Fase 8 — Expansión de agencia

- Clientes, proyectos y propuestas.
- Agenda y métricas de conversión.

## 14. Criterios de aceptación del MVP

- Solo puede entrar `upcodednow@gmail.com` con Google.
- Se pueden combinar varios nichos y ubicaciones oficiales.
- Una búsqueda produce prospectos sin bloquear la interfaz.
- Cada afirmación importante muestra evidencia y fecha.
- No se genera un mensaje para identidades dudosas.
- Los prospectos sin guardar se eliminan tras 24 horas.
- Los guardados sobreviven a la limpieza.
- Ninguna acción puede generar cargos automáticos.
- La aplicación funciona en escritorio y móvil sin perder acciones esenciales.
- Los tests de seguridad, deduplicación, scoring y expiración pasan antes del despliegue.

## 15. Presupuesto cero y límites operativos

El sistema debe tratar las cuotas gratuitas como límites duros, no como una invitación a habilitar facturación.

| Servicio | Uso | Límite relevante del plan gratuito | Comportamiento del CRM |
|---|---|---|---|
| Cloudflare Workers/Pages | Hosting y endpoints | Cuota diaria de requests y CPU reducida | Servir la interfaz; delegar los trabajos largos a Inngest |
| Supabase | Auth y PostgreSQL | 500 MB; el proyecto puede pausarse tras una semana sin actividad | Mantener datos compactos, health check y exportación local |
| Inngest Hobby | Pipeline en segundo plano | 50.000 ejecuciones mensuales | Contador interno; pausar búsquedas antes del límite |
| Tavily Researcher | Descubrimiento web | 1.000 créditos mensuales | Mostrar créditos estimados; bloquear nuevas campañas al agotarse |
| PageSpeed Insights | Auditoría opcional | Cuota y rate limit del servicio | Analizar solo finalistas; degradar a auditoría HTTP si no responde |

Reglas de protección:

- No registrar tarjetas ni habilitar pago por uso.
- Advertir al 70 %, limitar campañas al 85 % y detener al 95 % de cualquier cuota.
- Nunca repetir automáticamente una llamada que falló por límite.
- Permitir reanudar el siguiente período o ejecutar el análisis local.
- Exportar periódicamente el CRM a JSON/CSV para que un servicio gratuito pausado no bloquee el trabajo.

## 16. Orden de entrega recomendado

### Hito 1 — Fundaciones

Producto navegable, login exclusivo, base segura, layout y selector geográfico oficial.

### Hito 2 — Prospección verificable

Búsquedas, jobs, deduplicación, resolución de identidad, evidencias y bandeja temporal.

### Hito 3 — Conversión

Auditoría, puntuaciones, CRM permanente, mensajes Upcoded y seguimiento.

### Hito 4 — Robustez

Tests, límites gratuitos, exportación, responsive, accesibilidad, migración de ejemplos y despliegue.

No se empieza el módulo de clientes/proyectos hasta que el Hito 4 demuestre una reducción clara de falsos positivos en las campañas de prueba.
