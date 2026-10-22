# Barber Suites · README técnico

Web pública con reservas en línea y panel de administración para **Barber Suites**
(C.C. Santa Fe, Nivel C3, Local #20, Baruta, Caracas).

- **Stack:** Next.js 15 (App Router) + TypeScript + Tailwind CSS 4 · Supabase (Postgres, Auth, Storage) · Vercel
- **Zona horaria:** todas las reglas usan `America/Caracas` (UTC-4, sin horario de verano), tanto en la base de datos como en el servidor, sin importar la zona del servidor o del navegador.
- **Moneda:** USD.

---

## 1. Estructura

```
supabase/
  migrations/            Migraciones SQL versionadas (aplicar en orden)
    …000100_esquema.sql          Tablas, restricción anti doble reserva
    …000200_seguridad_rls.sql    RLS, vista de clientes, bucket de fotos
    …000300_funciones_reservas.sql  Disponibilidad pública y creación de reservas
    …000400_funciones_panel.sql  Funciones del panel (horarios, asignaciones)
    …000500_busqueda_clientes.sql  Búsqueda de clientes sin acentos
  seed.sql               Datos de EJEMPLO (3 barberos, 4 servicios, horarios)
  tests/                 Tests SQL (reglas, RLS, concurrencia)
src/
  lib/availability.ts    Cálculo de turnos libres (lógica pura + tests)
  lib/tz.ts              Utilidades de zona horaria sin dependencias
  lib/__tests__/         Tests de Vitest
  app/page.tsx           Home (servicios, barberos, trabajos, reserva, horario y mapa)
  app/reservar/          Página de reservas
  app/api/disponibilidad Turnos libres (GET)
  app/api/reservas       Crear reserva (POST)
  app/admin/             Panel: login, resumen, agenda, clientes, barberos,
                         horarios, bloqueos, servicios, ajustes
  middleware.ts          Protege /admin y refresca la sesión
```

## 2. Modelo de datos

| Tabla | Contenido |
|---|---|
| `barbers` | nombre, foto, bio, activo, orden |
| `services` | nombre, descripción, duración (min), precio USD, activo, orden |
| `barber_services` | qué servicios hace cada barbero |
| `working_hours` | horario semanal por barbero; varios bloques por día (0 = domingo … 6 = sábado). Los bloques del mismo día no se pueden solapar (exclusión). |
| `time_off` | bloqueos puntuales; `barber_id = null` = toda la barbería (feriado) |
| `bookings` | cita: barbero, servicio, cliente, inicio, fin, `blocked_until`, estado, origen (`web`/`admin`), precio congelado, notas |
| `settings` | una fila: intervalo entre turnos, anticipación mínima, días máximos, margen entre citas, WhatsApp, dirección, Instagram |
| `admins` | usuarios de Supabase Auth con acceso al panel |
| `booking_attempts` | registro de intentos de reserva (rate limit). Se limpia solo (>24 h). |
| vista `admin_customers` | clientes agrupados por teléfono (visitas, gasto, inasistencias…) |

Estados de una cita: `pendiente`, `confirmada`, `completada`, `cancelada`, `no_asistio`.

## 3. Reglas críticas y cómo se garantizan

**Cero reservas dobles.** `bookings` tiene una restricción de exclusión:

```sql
exclude using gist (barber_id with =, tstzrange(starts_at, blocked_until, '[)') with &&)
where (status <> 'cancelada')
```

`blocked_until = ends_at + margen` (lo calcula un trigger), así que el margen entre citas también queda protegido. Postgres rechaza el solape aunque alguien se salte la web, aunque dos clientes reserven en el mismo milisegundo (hay un test de concurrencia real) y aunque se intente reactivar una cita cancelada encima de otra.

**Las reservas solo se crean en el servidor.**
`POST /api/reservas` (route handler) → `create_booking_public()` (función SQL, solo ejecutable con `service_role`), que vuelve a validar:
servicio y barbero activos · el barbero hace el servicio · anticipación mínima · días máximos · dentro del horario laboral (incluye bordes y pausas) · sin bloqueos · sin solape (restricción).

**RLS activado en todas las tablas.**
- Público (`anon`): solo lee barberos y servicios activos. Los turnos se obtienen con `get_schedule_snapshot()`, que devuelve **solo rangos de tiempo ocupados** (sin nombres, teléfonos ni motivos de bloqueo).
- Admin (`authenticated` + fila en `admins`): lee y escribe todo.
- Un usuario autenticado que no es admin no ve nada.

**Anti-spam.** Honeypot (campo oculto `website`) + tiempo mínimo de llenado (2 s) en el formulario; en la base: máx. 8 intentos / 10 min por IP (hash con sal), 5 intentos / hora por teléfono y 3 citas futuras activas por teléfono. Los intentos fallidos también cuentan.

**Disponibilidad en el servidor.** `src/lib/availability.ts` calcula los turnos: horario laboral − bloqueos − citas (con margen), partido según el intervalo y la duración del servicio, respetando anticipación y días máximos. Es la misma regla que aplica la función SQL, que es la autoridad final.

**"Cualquier barbero".** El servidor elige, entre los barberos libres en ese turno, al que tiene menos citas ese día; si otro cliente lo toma en ese instante, prueba con el siguiente.

Códigos de error de las funciones: `SLOT_TAKEN`, `TOO_SOON`, `TOO_FAR`, `OUTSIDE_HOURS`, `TIME_OFF`, `INVALID_SERVICE`, `INVALID_BARBER`, `SERVICE_NOT_OFFERED`, `RATE_LIMIT`, `TOO_MANY_BOOKINGS`, `INVALID_INPUT`, `FORBIDDEN`. Los mensajes al cliente están en `src/lib/booking-errors.ts`.

## 4. Desarrollo local

Requisitos: Node 20+, Docker (para Supabase local) y el CLI de Supabase (`npx supabase`).

```bash
npm install
npx supabase start            # levanta Postgres, Auth, Storage y aplica migraciones + seed
cp .env.example .env.local    # pega la URL, la anon key y la service_role key que imprime `supabase start`
npm run dev                   # http://localhost:3000
```

Para no descargar servicios que no se usan:
`npx supabase start -x studio,imgproxy,edge-runtime,logflare,vector,realtime,supavisor,postgres-meta,mailpit`

Reiniciar la base local desde cero (migraciones + seed): `npx supabase db reset`.

## 5. Tests

```bash
npm test          # Vitest: disponibilidad, zona horaria, teléfonos, WhatsApp, .ics (43 tests)
npm run test:db   # SQL: reglas de reserva, RLS, anti-spam y concurrencia
npm run lint
npm run build
```

- `npm test` se ejecuta con `TZ=Asia/Tokyo` para demostrar que el cálculo no depende de la zona del servidor.
- `npm run test:db` crea una base desechable en un Postgres local (≥ 15, con `btree_gist` y `unaccent`), aplica un *shim* mínimo de Supabase (`supabase/tests/supabase_shim.sql`), las migraciones y el seed, y ejecuta los tests. Usa las variables estándar `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`. Ejemplo: `PGHOST=localhost PGPASSWORD=postgres npm run test:db`.

## 6. Supabase en producción

1. Crea un proyecto en [supabase.com](https://supabase.com) (región más cercana: `us-east-1`).
2. Aplica las migraciones:
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref-del-proyecto>
   npx supabase db push
   ```
   (Alternativa sin terminal: abre `supabase/instalar-todo.sql`, cópialo entero en el *SQL Editor* de Supabase y pulsa *Run*. Incluye todas las migraciones y los datos de ejemplo. Si cambias una migración, regenera ese archivo.)
3. **Datos de ejemplo (opcional):** ejecuta `supabase/seed.sql` en el SQL Editor. Son de ejemplo: el dueño los reemplaza desde el panel.
4. **Auth:**
   - *Authentication → Sign In / Providers → Email*: deja Email activado y **desactiva "Allow new users to sign up"**. Los usuarios del panel se crean a mano (paso 7).
   - *Authentication → URL Configuration*: pon la URL de producción como *Site URL*.
5. **Storage:** la migración 002 crea el bucket público `barber-photos` con sus políticas (solo admin sube/borra). No hay que hacer nada más.
6. Copia de *Project Settings → API*: `Project URL`, `anon public` y `service_role` (secreta).

### 7. Crear el primer admin

**Forma automática (recomendada):** con Supabase conectado en Vercel (integración de Storage, que crea `NEXT_PUBLIC_SUPABASE_URL`, la clave pública, `SUPABASE_SERVICE_ROLE_KEY` y `POSTGRES_URL`), abre `https://<tu-dominio>/admin`. Mientras no haya ningún administrador, la web muestra **"Crea tu acceso al panel"**: escribes correo y clave (mínimo 6 caracteres) y la web crea las tablas (si la base está vacía, con `supabase/instalar-todo.sql`), el usuario y el permiso de administrador, e inicia la sesión. Esa pantalla deja de funcionar en cuanto existe un administrador.

**Forma manual:**

1. *Authentication → Users → Add user → Create new user*: email y contraseña, marca **Auto Confirm User**.
2. En el *SQL Editor*:
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'dueno@ejemplo.com';
   ```
3. Entra en `https://<tu-dominio>/admin` con ese email y contraseña.

Para quitar el acceso a alguien: `delete from public.admins where user_id = (select id from auth.users where email = '…');`

## 8. Deploy en Vercel

1. Importa el repositorio en [vercel.com/new](https://vercel.com/new) (framework: Next.js, sin cambios en build).
2. Variables de entorno (*Settings → Environment Variables*), ver `.env.example`:

   | Variable | Valor |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL de Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public key |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key (**secreta**, solo servidor) |
   | `RATE_LIMIT_SALT` | texto largo aleatorio (`openssl rand -hex 32`) |
   | `NEXT_PUBLIC_SITE_URL` | `https://tu-dominio.com` |

3. Deploy. Después, añade el dominio propio en *Settings → Domains* y actualiza `NEXT_PUBLIC_SITE_URL` y la *Site URL* de Supabase.

Notas:
- La IP del cliente para el rate limit se toma de `x-forwarded-for` (Vercel la rellena).
- Las fotos de barberos se sirven desde Supabase Storage; `next.config.ts` ya permite ese dominio.
- La home se regenera cada 60 s; los cambios del panel la invalidan al momento.

## 9. Pendientes de negocio

Ver `PENDIENTES.md` (nombres y fotos reales de barberos, servicios y precios, horarios de cada día, fotos de la galería, dominio).
