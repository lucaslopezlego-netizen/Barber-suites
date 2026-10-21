# Barber Suites · notas para Claude

- Stack: Next.js 15 (App Router) + TypeScript + Tailwind 4 + Supabase. Interfaz 100 % en español.
- Diseño: usar la skill del proyecto `.claude/skills/frontend-design` para cualquier cambio visual.
  Identidad fija del brief: fondo negro, acentos dorados, estilo premium, logo con tijeras doradas "BS".
  Tokens en `src/app/globals.css` (@theme). Cinzel solo para la marca y los precios; Manrope para todo lo demás.
  Evitar: etiquetas en MAYÚSCULAS con tracking, frases resaltadas en dorado dentro de un titular, "→" en enlaces,
  cadenas con " · " en la web pública, degradados decorativos.
- Zona horaria: siempre `America/Caracas` (src/lib/tz.ts). Precios en USD.
- Reglas de reserva: la autoridad es SQL (`create_booking_public`, restricción de exclusión). `src/lib/availability.ts` debe reflejar las mismas reglas.
- Verificar antes de commit: `npm test`, `npm run test:db` (Postgres local), `npm run lint`, `npm run build`.
