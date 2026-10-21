# Barber Suites · notas para Claude

- Stack: Next.js 15 (App Router) + TypeScript + Tailwind 4 + Supabase. Interfaz 100 % en español.
- Diseño: usar la skill del proyecto `.claude/skills/frontend-design` para cualquier cambio visual.
  Tema CLARO (pedido del cliente): pared blanca (`page`), azulejo gris para secciones alternas y el fondo del panel
  (`surface`), texto `fg`, negro del logo (`onyx`) para títulos, botón principal y estados seleccionados, y dorado
  latón (`gold`) solo para acentos pequeños. El tablero de precios es la única pieza oscura (clase `.leather`, dorado `gold-light`).
  Tokens en `src/app/globals.css` (@theme). Cinzel (`.title-display`) para títulos, marca y precios; Manrope para el resto.
  Orden: todas las secciones de la portada usan el componente `Section` (título a la izquierda y nota al lado) y la constante `CONTAINER`.
  Seleccionado o activo = fondo negro y texto blanco, en toda la web y el panel.
  Evitar: etiquetas en MAYÚSCULAS con tracking, frases resaltadas en dorado dentro de un titular, "→" en enlaces,
  cadenas con " · " en la web pública, degradados decorativos, fondo crema.
- Zona horaria: siempre `America/Caracas` (src/lib/tz.ts). Precios en USD.
- Reglas de reserva: la autoridad es SQL (`create_booking_public`, restricción de exclusión). `src/lib/availability.ts` debe reflejar las mismas reglas.
- Verificar antes de commit: `npm test`, `npm run test:db` (Postgres local), `npm run lint`, `npm run build`.
