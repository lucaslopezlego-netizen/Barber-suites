# Barber Suites

Web y sistema de reservas de **Barber Suites**, la barbería del C.C. Santa Fe (Baruta, Caracas).

- **Web pública:** servicios y precios (USD), barberos, trabajos realizados, horario, mapa y reserva en línea en 5 pasos.
- **Panel `/admin`:** resumen del negocio, agenda por día y semana, clientes, barberos, horarios, bloqueos, servicios y ajustes.

| Documento | Para quién |
|---|---|
| [`GUIA-DEL-CLIENTE.md`](./GUIA-DEL-CLIENTE.md) | El dueño: cómo usar el panel |
| [`README-tecnico.md`](./README-tecnico.md) | Desarrollo: instalación, Supabase, primer admin, deploy en Vercel |
| [`PENDIENTES.md`](./PENDIENTES.md) | Datos de ejemplo que hay que reemplazar |

```bash
npm install && npx supabase start && cp .env.example .env.local && npm run dev
```
