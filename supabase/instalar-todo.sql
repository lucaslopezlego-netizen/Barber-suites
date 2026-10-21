-- =============================================================================
-- Barber Suites · INSTALACIÓN COMPLETA (pegar entero en Supabase → SQL Editor → Run)
-- Crea tablas, seguridad, funciones y los datos de EJEMPLO.
-- Generado a partir de supabase/migrations/*.sql + supabase/seed.sql.
-- Ejecutar UNA sola vez en una base de datos nueva.
-- =============================================================================

-- >>> 20261021000100_esquema.sql
-- =============================================================================
-- Barber Suites · 001 · Esquema base
-- Tablas del sistema de reservas. Todas las horas se guardan como timestamptz
-- (UTC internamente) y se interpretan en la zona de `settings.timezone`
-- (America/Caracas por defecto).
-- =============================================================================

create extension if not exists btree_gist with schema extensions;

-- Estados de una cita
create type public.booking_status as enum (
  'pendiente',
  'confirmada',
  'completada',
  'cancelada',
  'no_asistio'
);

-- Origen de la cita: reservada por el cliente en la web o creada en el panel
create type public.booking_source as enum ('web', 'admin');

-- -----------------------------------------------------------------------------
-- Utilidad: mantener updated_at al día
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Administradores: usuarios de Supabase Auth con acceso al panel
-- -----------------------------------------------------------------------------
create table public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Ajustes generales (una sola fila, id = 1)
-- -----------------------------------------------------------------------------
create table public.settings (
  id                smallint primary key default 1 check (id = 1),
  slot_interval_min integer not null default 15  check (slot_interval_min between 5 and 120),
  min_notice_min    integer not null default 60  check (min_notice_min between 0 and 10080),
  max_days_ahead    integer not null default 30  check (max_days_ahead between 1 and 365),
  buffer_min        integer not null default 0   check (buffer_min between 0 and 120),
  timezone          text    not null default 'America/Caracas',
  business_name     text    not null default 'Barber Suites',
  whatsapp          text    not null default '+584222522392',
  address           text    not null default 'Centro Comercial Santa Fe, Nivel C3, Local #20, Baruta, Caracas',
  instagram         text             default 'cmbarber08',
  updated_at        timestamptz not null default now()
);

insert into public.settings (id) values (1);

create trigger settings_updated_at
  before update on public.settings
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Barberos
-- -----------------------------------------------------------------------------
create table public.barbers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(btrim(name)) between 2 and 60),
  photo_url  text,
  bio        text check (bio is null or char_length(bio) <= 280),
  active     boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index barbers_active_order_idx on public.barbers (active, sort_order);

create trigger barbers_updated_at
  before update on public.barbers
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Servicios (precios en USD)
-- -----------------------------------------------------------------------------
create table public.services (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(btrim(name)) between 2 and 80),
  description  text check (description is null or char_length(description) <= 280),
  duration_min integer not null check (duration_min between 5 and 480),
  price_usd    numeric(10, 2) not null check (price_usd >= 0),
  active       boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index services_active_order_idx on public.services (active, sort_order);

create trigger services_updated_at
  before update on public.services
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Qué servicios hace cada barbero
-- -----------------------------------------------------------------------------
create table public.barber_services (
  barber_id  uuid not null references public.barbers (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  primary key (barber_id, service_id)
);

create index barber_services_service_idx on public.barber_services (service_id);

-- -----------------------------------------------------------------------------
-- Horario laboral semanal. weekday: 0 = domingo … 6 = sábado (igual que
-- extract(dow) y Date.getDay()). Se permiten varios bloques por día
-- (p. ej. 9:00–13:00 y 14:00–18:00), pero no bloques que se solapen.
-- -----------------------------------------------------------------------------
create table public.working_hours (
  id         uuid primary key default gen_random_uuid(),
  barber_id  uuid not null references public.barbers (id) on delete cascade,
  weekday    smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time   time not null,
  created_at timestamptz not null default now(),
  constraint working_hours_order check (start_time < end_time),
  constraint working_hours_no_overlap exclude using gist (
    barber_id with =,
    weekday with =,
    tsrange(date '2000-01-01' + start_time, date '2000-01-01' + end_time, '[)') with &&
  )
);

-- -----------------------------------------------------------------------------
-- Bloqueos puntuales (vacaciones, día libre, diligencias…).
-- barber_id NULL = bloqueo para toda la barbería (p. ej. un feriado).
-- -----------------------------------------------------------------------------
create table public.time_off (
  id         uuid primary key default gen_random_uuid(),
  barber_id  uuid references public.barbers (id) on delete cascade,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  reason     text check (reason is null or char_length(reason) <= 140),
  created_at timestamptz not null default now(),
  constraint time_off_order check (starts_at < ends_at)
);

create index time_off_range_idx on public.time_off using gist (tstzrange(starts_at, ends_at, '[)'));
create index time_off_barber_idx on public.time_off (barber_id);

-- -----------------------------------------------------------------------------
-- Citas
-- blocked_until = ends_at + margen entre citas (settings.buffer_min) en el
-- momento de crearla. La restricción de exclusión usa [starts_at, blocked_until)
-- para que sea IMPOSIBLE, a nivel de base de datos, que un barbero tenga dos
-- citas activas que se solapen (incluido el margen).
-- -----------------------------------------------------------------------------
create table public.bookings (
  id             uuid primary key default gen_random_uuid(),
  barber_id      uuid not null references public.barbers (id) on delete restrict,
  service_id     uuid not null references public.services (id) on delete restrict,
  customer_name  text not null check (char_length(btrim(customer_name)) between 2 and 80),
  customer_phone text not null check (customer_phone ~ '^\+?[0-9]{7,15}$'),
  customer_email text check (customer_email is null or customer_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  starts_at      timestamptz not null,
  ends_at        timestamptz not null,
  blocked_until  timestamptz not null,
  status         public.booking_status not null default 'pendiente',
  source         public.booking_source not null default 'web',
  price_usd      numeric(10, 2) not null check (price_usd >= 0),
  notes          text check (notes is null or char_length(notes) <= 500),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint bookings_order check (starts_at < ends_at and ends_at <= blocked_until),
  constraint bookings_no_overlap exclude using gist (
    barber_id with =,
    tstzrange(starts_at, blocked_until, '[)') with &&
  ) where (status <> 'cancelada')
);

create index bookings_starts_idx on public.bookings (starts_at);
create index bookings_phone_idx on public.bookings (customer_phone);
create index bookings_status_idx on public.bookings (status);

-- Calcula blocked_until al crear la cita o al cambiarle la hora
create or replace function public.bookings_set_blocked_until()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_buffer integer;
begin
  if tg_op = 'INSERT'
     or new.starts_at is distinct from old.starts_at
     or new.ends_at is distinct from old.ends_at then
    select s.buffer_min into v_buffer from public.settings s where s.id = 1;
    new.blocked_until := new.ends_at + make_interval(mins => coalesce(v_buffer, 0));
  end if;
  return new;
end;
$$;

create trigger bookings_blocked_until
  before insert or update on public.bookings
  for each row execute function public.bookings_set_blocked_until();

create trigger bookings_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Registro de intentos de reserva desde la web (anti-spam / rate limit).
-- Solo lo usan las funciones del servidor; nadie lo lee desde el cliente.
-- -----------------------------------------------------------------------------
create table public.booking_attempts (
  id             bigint generated always as identity primary key,
  ip_hash        text,
  customer_phone text,
  created_at     timestamptz not null default now()
);

create index booking_attempts_ip_idx on public.booking_attempts (ip_hash, created_at);
create index booking_attempts_phone_idx on public.booking_attempts (customer_phone, created_at);

-- >>> 20261021000200_seguridad_rls.sql
-- =============================================================================
-- Barber Suites · 002 · Seguridad (RLS)
-- Regla general:
--   · Público (anon): solo lee barberos y servicios ACTIVOS (y qué servicio hace
--     cada barbero). Los turnos libres se obtienen con get_schedule_snapshot(),
--     que nunca devuelve datos de clientes.
--   · Admin autenticado (fila en public.admins): lee y escribe todo.
--   · Todo lo demás está cerrado.
-- =============================================================================

-- ¿El usuario actual es administrador?
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins a where a.user_id = auth.uid()
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;

-- Activar RLS en TODAS las tablas
alter table public.admins           enable row level security;
alter table public.settings         enable row level security;
alter table public.barbers          enable row level security;
alter table public.services         enable row level security;
alter table public.barber_services  enable row level security;
alter table public.working_hours    enable row level security;
alter table public.time_off         enable row level security;
alter table public.bookings         enable row level security;
alter table public.booking_attempts enable row level security;

-- -----------------------------------------------------------------------------
-- admins: cada usuario puede ver solo SU fila (para saber si es admin).
-- Las altas se hacen desde SQL (ver README-tecnico.md), nunca desde la web.
-- -----------------------------------------------------------------------------
create policy "admins: ver la propia fila"
  on public.admins for select
  to authenticated
  using (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- barbers
-- -----------------------------------------------------------------------------
create policy "barbers: público ve los activos"
  on public.barbers for select
  to anon, authenticated
  using (active or public.is_admin());

create policy "barbers: admin gestiona"
  on public.barbers for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- services
-- -----------------------------------------------------------------------------
create policy "services: público ve los activos"
  on public.services for select
  to anon, authenticated
  using (active or public.is_admin());

create policy "services: admin gestiona"
  on public.services for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- barber_services: público ve solo relaciones entre barbero y servicio activos
-- -----------------------------------------------------------------------------
create policy "barber_services: público ve los activos"
  on public.barber_services for select
  to anon, authenticated
  using (
    public.is_admin()
    or (
      exists (select 1 from public.barbers b where b.id = barber_id and b.active)
      and exists (select 1 from public.services s where s.id = service_id and s.active)
    )
  );

create policy "barber_services: admin gestiona"
  on public.barber_services for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- Tablas solo para admin
-- -----------------------------------------------------------------------------
create policy "settings: admin gestiona"
  on public.settings for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "working_hours: admin gestiona"
  on public.working_hours for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "time_off: admin gestiona"
  on public.time_off for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "bookings: admin gestiona"
  on public.bookings for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- booking_attempts: sin políticas => nadie accede salvo funciones del servidor.

-- -----------------------------------------------------------------------------
-- Vista de clientes para el panel (agrupa las citas por teléfono).
-- security_invoker = true => respeta el RLS de bookings: solo admin ve filas.
-- -----------------------------------------------------------------------------
create view public.admin_customers
with (security_invoker = true)
as
select
  b.customer_phone                                                      as phone,
  (array_agg(b.customer_name order by b.created_at desc))[1]            as name,
  (array_agg(b.customer_email order by b.created_at desc)
     filter (where b.customer_email is not null))[1]                    as email,
  count(*)                                                              as total_bookings,
  count(*) filter (where b.status = 'completada')                       as completed,
  count(*) filter (where b.status = 'no_asistio')                       as no_shows,
  count(*) filter (where b.status = 'cancelada')                        as cancelled,
  coalesce(sum(b.price_usd) filter (where b.status = 'completada'), 0)  as total_spent_usd,
  max(b.starts_at) filter (where b.status = 'completada')               as last_visit,
  min(b.starts_at) filter (where b.status in ('pendiente', 'confirmada')
                             and b.starts_at > now())                   as next_booking,
  min(b.created_at)                                                     as first_seen
from public.bookings b
group by b.customer_phone;

revoke all on public.admin_customers from anon;
grant select on public.admin_customers to authenticated;

-- -----------------------------------------------------------------------------
-- Storage: fotos de barberos. Bucket público para lectura (las fotos se ven en
-- la web); solo admin puede subir, cambiar o borrar.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('barber-photos', 'barber-photos', true)
on conflict (id) do nothing;

create policy "barber-photos: admin sube"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'barber-photos' and public.is_admin());

create policy "barber-photos: admin actualiza"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'barber-photos' and public.is_admin())
  with check (bucket_id = 'barber-photos' and public.is_admin());

create policy "barber-photos: admin borra"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'barber-photos' and public.is_admin());

-- >>> 20261021000300_funciones_reservas.sql
-- =============================================================================
-- Barber Suites · 003 · Funciones de reservas
--   · normalize_phone()          → formato único de teléfono (+58…)
--   · get_schedule_snapshot()    → datos para calcular turnos libres, SIN datos
--                                  de clientes (público)
--   · public_business_info()     → datos del negocio y horario semanal (público)
--   · create_booking_public()    → crea una reserva desde la web (solo servidor)
--   · admin_create_booking()     → crea una cita desde el panel (solo admin)
-- Códigos de error (campo "error" o mensaje de la excepción):
--   INVALID_INPUT, INVALID_SERVICE, INVALID_BARBER, SERVICE_NOT_OFFERED,
--   TOO_SOON, TOO_FAR, OUTSIDE_HOURS, TIME_OFF, SLOT_TAKEN, RATE_LIMIT,
--   TOO_MANY_BOOKINGS, FORBIDDEN
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Teléfonos: se guardan como +<código país><número>, solo dígitos.
-- Acepta formatos venezolanos habituales: 0422-2522392, 4222522392,
-- 58 422 2522392, +58 (422) 252-2392…
-- -----------------------------------------------------------------------------
create or replace function public.normalize_phone(p_phone text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_digits text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
begin
  if btrim(coalesce(p_phone, '')) like '+%' then
    return '+' || v_digits;
  elsif v_digits like '00%' then
    return '+' || substr(v_digits, 3);
  elsif v_digits like '58%' and char_length(v_digits) = 12 then
    return '+' || v_digits;
  elsif v_digits like '0%' and char_length(v_digits) = 11 then
    return '+58' || substr(v_digits, 2);
  elsif char_length(v_digits) = 10 then
    return '+58' || v_digits;
  end if;
  return '+' || v_digits;
end;
$$;

-- -----------------------------------------------------------------------------
-- Datos para calcular disponibilidad entre p_from y p_to.
-- Devuelve SOLO rangos de tiempo ocupados: ni nombres, ni teléfonos, ni
-- motivos de bloqueo. El rango se limita a 62 días.
-- -----------------------------------------------------------------------------
create or replace function public.get_schedule_snapshot(p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_to timestamptz;
  v_result jsonb;
begin
  if p_from is null or p_to is null or p_to <= p_from then
    raise exception 'INVALID_INPUT' using detail = 'Rango de fechas inválido';
  end if;
  v_to := least(p_to, p_from + interval '62 days');

  select jsonb_build_object(
    'generated_at', now(),
    'range', jsonb_build_object('from', p_from, 'to', v_to),
    'settings', (
      select jsonb_build_object(
        'slot_interval_min', s.slot_interval_min,
        'min_notice_min',    s.min_notice_min,
        'max_days_ahead',    s.max_days_ahead,
        'buffer_min',        s.buffer_min,
        'timezone',          s.timezone
      )
      from public.settings s where s.id = 1
    ),
    'services', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', sv.id, 'name', sv.name, 'description', sv.description,
        'duration_min', sv.duration_min, 'price_usd', sv.price_usd
      ) order by sv.sort_order, sv.name)
      from public.services sv where sv.active
    ), '[]'::jsonb),
    'barbers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id, 'name', b.name, 'photo_url', b.photo_url, 'bio', b.bio,
        'service_ids', coalesce((
          select jsonb_agg(bs.service_id)
          from public.barber_services bs
          join public.services sv on sv.id = bs.service_id and sv.active
          where bs.barber_id = b.id
        ), '[]'::jsonb)
      ) order by b.sort_order, b.name)
      from public.barbers b where b.active
    ), '[]'::jsonb),
    'working_hours', coalesce((
      select jsonb_agg(jsonb_build_object(
        'barber_id',  wh.barber_id,
        'weekday',    wh.weekday,
        'start_time', to_char(wh.start_time, 'HH24:MI'),
        'end_time',   to_char(wh.end_time, 'HH24:MI')
      ) order by wh.barber_id, wh.weekday, wh.start_time)
      from public.working_hours wh
      join public.barbers b on b.id = wh.barber_id and b.active
    ), '[]'::jsonb),
    'time_off', coalesce((
      select jsonb_agg(jsonb_build_object(
        'barber_id', t.barber_id, 'starts_at', t.starts_at, 'ends_at', t.ends_at
      ) order by t.starts_at)
      from public.time_off t
      where t.starts_at < v_to and t.ends_at > p_from
    ), '[]'::jsonb),
    'busy', coalesce((
      select jsonb_agg(jsonb_build_object(
        'barber_id', bk.barber_id, 'starts_at', bk.starts_at, 'ends_at', bk.blocked_until
      ) order by bk.starts_at)
      from public.bookings bk
      where bk.status <> 'cancelada'
        and bk.starts_at < v_to
        and bk.blocked_until > p_from
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

-- -----------------------------------------------------------------------------
-- Información pública del negocio + horario semanal resumido (la hora más
-- temprana de apertura y la más tardía de cierre entre los barberos activos).
-- -----------------------------------------------------------------------------
create or replace function public.public_business_info()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'business_name', s.business_name,
    'whatsapp',      s.whatsapp,
    'address',       s.address,
    'instagram',     s.instagram,
    'timezone',      s.timezone,
    'max_days_ahead', s.max_days_ahead,
    'weekly_hours', (
      select jsonb_agg(jsonb_build_object(
        'weekday', d.weekday,
        'open',    (select to_char(min(wh.start_time), 'HH24:MI')
                    from public.working_hours wh
                    join public.barbers b on b.id = wh.barber_id and b.active
                    where wh.weekday = d.weekday),
        'close',   (select to_char(max(wh.end_time), 'HH24:MI')
                    from public.working_hours wh
                    join public.barbers b on b.id = wh.barber_id and b.active
                    where wh.weekday = d.weekday)
      ) order by d.weekday)
      from generate_series(0, 6) as d(weekday)
    )
  )
  from public.settings s
  where s.id = 1;
$$;

-- -----------------------------------------------------------------------------
-- Núcleo de creación de citas (interno, no se expone).
-- p_enforce = true  → reglas completas (web): servicio/barbero activos, el
--                     barbero hace ese servicio, anticipación mínima, días
--                     máximos, dentro del horario laboral y sin bloqueos.
-- p_enforce = false → panel admin (clientes sin cita previa): se saltan esas
--                     reglas, PERO nunca el solapamiento con otra cita.
-- -----------------------------------------------------------------------------
create or replace function public._insert_booking(
  p_barber_id  uuid,
  p_service_id uuid,
  p_starts_at  timestamptz,
  p_name       text,
  p_phone      text,
  p_email      text,
  p_notes      text,
  p_source     public.booking_source,
  p_status     public.booking_status,
  p_enforce    boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings    public.settings%rowtype;
  v_service     public.services%rowtype;
  v_barber      public.barbers%rowtype;
  v_ends_at     timestamptz;
  v_local_start timestamp;
  v_local_end   timestamp;
  v_name        text := btrim(coalesce(p_name, ''));
  v_phone       text := public.normalize_phone(p_phone);
  v_email       text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_notes       text := nullif(btrim(coalesce(p_notes, '')), '');
  v_id          uuid;
begin
  if p_barber_id is null or p_service_id is null or p_starts_at is null then
    raise exception 'INVALID_INPUT' using detail = 'Faltan datos de la reserva';
  end if;
  if char_length(v_name) not between 2 and 80 then
    raise exception 'INVALID_INPUT' using detail = 'Nombre inválido';
  end if;
  if v_phone !~ '^\+[0-9]{7,15}$' then
    raise exception 'INVALID_INPUT' using detail = 'Teléfono inválido';
  end if;
  if v_email is not null and v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'INVALID_INPUT' using detail = 'Email inválido';
  end if;

  select * into v_settings from public.settings where id = 1;

  select * into v_service from public.services where id = p_service_id;
  if not found or (p_enforce and not v_service.active) then
    raise exception 'INVALID_SERVICE' using detail = 'El servicio no está disponible';
  end if;

  select * into v_barber from public.barbers where id = p_barber_id;
  if not found or (p_enforce and not v_barber.active) then
    raise exception 'INVALID_BARBER' using detail = 'El barbero no está disponible';
  end if;

  v_ends_at := p_starts_at + make_interval(mins => v_service.duration_min);

  if p_enforce then
    if not exists (
      select 1 from public.barber_services bs
      where bs.barber_id = p_barber_id and bs.service_id = p_service_id
    ) then
      raise exception 'SERVICE_NOT_OFFERED' using detail = 'Este barbero no realiza ese servicio';
    end if;

    if p_starts_at < now() + make_interval(mins => v_settings.min_notice_min) then
      raise exception 'TOO_SOON' using detail = 'La hora elegida no cumple la anticipación mínima';
    end if;

    v_local_start := p_starts_at at time zone v_settings.timezone;
    v_local_end   := v_ends_at   at time zone v_settings.timezone;

    if v_local_start::date > (now() at time zone v_settings.timezone)::date + v_settings.max_days_ahead then
      raise exception 'TOO_FAR' using detail = 'La fecha supera el máximo de días permitidos';
    end if;

    if v_local_end::date <> v_local_start::date or not exists (
      select 1 from public.working_hours wh
      where wh.barber_id  = p_barber_id
        and wh.weekday    = extract(dow from v_local_start)::smallint
        and wh.start_time <= v_local_start::time
        and wh.end_time   >= v_local_end::time
    ) then
      raise exception 'OUTSIDE_HOURS' using detail = 'Fuera del horario del barbero';
    end if;

    if exists (
      select 1 from public.time_off t
      where (t.barber_id = p_barber_id or t.barber_id is null)
        and t.starts_at < v_ends_at
        and t.ends_at   > p_starts_at
    ) then
      raise exception 'TIME_OFF' using detail = 'El barbero no está disponible en ese horario';
    end if;
  end if;

  begin
    insert into public.bookings (
      barber_id, service_id, customer_name, customer_phone, customer_email,
      starts_at, ends_at, blocked_until, status, source, price_usd, notes
    ) values (
      p_barber_id, p_service_id, v_name, v_phone, v_email,
      p_starts_at, v_ends_at, v_ends_at, p_status, p_source, v_service.price_usd, v_notes
    )
    returning id into v_id;
  exception when exclusion_violation then
    raise exception 'SLOT_TAKEN' using detail = 'Ese horario acaba de ser reservado';
  end;

  return jsonb_build_object(
    'id',            v_id,
    'starts_at',     p_starts_at,
    'ends_at',       v_ends_at,
    'status',        p_status,
    'customer_name', v_name,
    'barber',  jsonb_build_object('id', v_barber.id, 'name', v_barber.name),
    'service', jsonb_build_object(
      'id', v_service.id, 'name', v_service.name,
      'duration_min', v_service.duration_min, 'price_usd', v_service.price_usd
    )
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Reserva desde la web. Solo la llama el servidor (service_role) desde el
-- route handler, que es quien conoce la IP real del cliente.
-- Nunca lanza excepción por reglas de negocio: devuelve {ok, error, detail}
-- para que el intento quede registrado igualmente (rate limit).
-- -----------------------------------------------------------------------------
create or replace function public.create_booking_public(
  p_barber_id  uuid,
  p_service_id uuid,
  p_starts_at  timestamptz,
  p_name       text,
  p_phone      text,
  p_email      text default null,
  p_notes      text default null,
  p_ip_hash    text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone   text := public.normalize_phone(p_phone);
  v_booking jsonb;
  v_msg     text;
  v_detail  text;
begin
  -- Limpieza de intentos viejos
  delete from public.booking_attempts where created_at < now() - interval '1 day';

  -- Rate limit: 8 intentos cada 10 min por IP, 5 por hora por teléfono
  if p_ip_hash is not null and (
    select count(*) from public.booking_attempts
    where ip_hash = p_ip_hash and created_at > now() - interval '10 minutes'
  ) >= 8 then
    return jsonb_build_object('ok', false, 'error', 'RATE_LIMIT',
      'detail', 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.');
  end if;

  if (
    select count(*) from public.booking_attempts
    where customer_phone = v_phone and created_at > now() - interval '1 hour'
  ) >= 5 then
    return jsonb_build_object('ok', false, 'error', 'RATE_LIMIT',
      'detail', 'Demasiados intentos con este teléfono. Escríbenos por WhatsApp.');
  end if;

  insert into public.booking_attempts (ip_hash, customer_phone) values (p_ip_hash, v_phone);

  -- Máximo 3 citas futuras activas por teléfono
  if (
    select count(*) from public.bookings
    where customer_phone = v_phone
      and status in ('pendiente', 'confirmada')
      and starts_at > now()
  ) >= 3 then
    return jsonb_build_object('ok', false, 'error', 'TOO_MANY_BOOKINGS',
      'detail', 'Ya tienes varias citas pendientes. Escríbenos por WhatsApp para gestionarlas.');
  end if;

  begin
    v_booking := public._insert_booking(
      p_barber_id, p_service_id, p_starts_at, p_name, p_phone, p_email, p_notes,
      'web', 'pendiente', true
    );
  exception when raise_exception then
    get stacked diagnostics v_msg = message_text, v_detail = pg_exception_detail;
    return jsonb_build_object('ok', false, 'error', v_msg, 'detail', v_detail);
  end;

  return jsonb_build_object('ok', true, 'booking', v_booking);
end;
$$;

-- -----------------------------------------------------------------------------
-- Cita creada desde el panel (cliente sin cita previa, llamada, etc.).
-- p_enforce_rules = false por defecto: el admin puede saltarse horario y
-- anticipación, pero NUNCA crear un solapamiento.
-- -----------------------------------------------------------------------------
create or replace function public.admin_create_booking(
  p_barber_id     uuid,
  p_service_id    uuid,
  p_starts_at     timestamptz,
  p_name          text,
  p_phone         text,
  p_email         text default null,
  p_notes         text default null,
  p_status        public.booking_status default 'confirmada',
  p_enforce_rules boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN' using detail = 'Solo administradores';
  end if;
  return public._insert_booking(
    p_barber_id, p_service_id, p_starts_at, p_name, p_phone, p_email, p_notes,
    'admin', coalesce(p_status, 'confirmada'), coalesce(p_enforce_rules, false)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Permisos de ejecución (Supabase concede EXECUTE a anon/authenticated por
-- defecto: lo retiramos explícitamente y damos solo lo necesario).
-- -----------------------------------------------------------------------------
revoke all on function public.normalize_phone(text) from public, anon, authenticated;
revoke all on function public.get_schedule_snapshot(timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.public_business_info() from public, anon, authenticated;
revoke all on function public._insert_booking(uuid, uuid, timestamptz, text, text, text, text, public.booking_source, public.booking_status, boolean) from public, anon, authenticated, service_role;
revoke all on function public.create_booking_public(uuid, uuid, timestamptz, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.admin_create_booking(uuid, uuid, timestamptz, text, text, text, text, public.booking_status, boolean) from public, anon;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.bookings_set_blocked_until() from public, anon, authenticated;

grant execute on function public.normalize_phone(text) to anon, authenticated, service_role;
grant execute on function public.get_schedule_snapshot(timestamptz, timestamptz) to anon, authenticated, service_role;
grant execute on function public.public_business_info() to anon, authenticated, service_role;
grant execute on function public.create_booking_public(uuid, uuid, timestamptz, text, text, text, text, text) to service_role;
grant execute on function public.admin_create_booking(uuid, uuid, timestamptz, text, text, text, text, public.booking_status, boolean) to authenticated, service_role;

-- >>> 20261021000400_funciones_panel.sql
-- =============================================================================
-- Barber Suites · 004 · Funciones del panel admin
-- =============================================================================

-- Reemplaza el horario semanal completo de un barbero en una sola transacción.
-- p_blocks: [{"weekday": 2, "start_time": "09:00", "end_time": "13:00"}, …]
-- SECURITY INVOKER: el RLS de working_hours se aplica (solo admin).
create or replace function public.admin_set_working_hours(p_barber_id uuid, p_blocks jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN' using detail = 'Solo administradores';
  end if;
  if jsonb_typeof(coalesce(p_blocks, '[]'::jsonb)) <> 'array' then
    raise exception 'INVALID_INPUT' using detail = 'Formato de horario inválido';
  end if;

  delete from public.working_hours where barber_id = p_barber_id;

  insert into public.working_hours (barber_id, weekday, start_time, end_time)
  select p_barber_id, (b ->> 'weekday')::smallint, (b ->> 'start_time')::time, (b ->> 'end_time')::time
  from jsonb_array_elements(coalesce(p_blocks, '[]'::jsonb)) as b;

  get diagnostics v_count = row_count;
  return v_count;
exception
  when exclusion_violation then
    raise exception 'OVERLAP' using detail = 'Hay bloques de horario que se solapan el mismo día';
  when check_violation then
    raise exception 'INVALID_RANGE' using detail = 'La hora de inicio debe ser anterior a la de fin';
end;
$$;

-- Asigna exactamente estos servicios a un barbero (o barberos a un servicio).
create or replace function public.admin_set_barber_services(p_barber_id uuid, p_service_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN' using detail = 'Solo administradores';
  end if;
  delete from public.barber_services where barber_id = p_barber_id and not (service_id = any (coalesce(p_service_ids, '{}')));
  insert into public.barber_services (barber_id, service_id)
  select p_barber_id, unnest(coalesce(p_service_ids, '{}'))
  on conflict do nothing;
end;
$$;

create or replace function public.admin_set_service_barbers(p_service_id uuid, p_barber_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN' using detail = 'Solo administradores';
  end if;
  delete from public.barber_services where service_id = p_service_id and not (barber_id = any (coalesce(p_barber_ids, '{}')));
  insert into public.barber_services (barber_id, service_id)
  select unnest(coalesce(p_barber_ids, '{}')), p_service_id
  on conflict do nothing;
end;
$$;

revoke all on function public.admin_set_working_hours(uuid, jsonb) from public, anon;
revoke all on function public.admin_set_barber_services(uuid, uuid[]) from public, anon;
revoke all on function public.admin_set_service_barbers(uuid, uuid[]) from public, anon;
grant execute on function public.admin_set_working_hours(uuid, jsonb) to authenticated;
grant execute on function public.admin_set_barber_services(uuid, uuid[]) to authenticated;
grant execute on function public.admin_set_service_barbers(uuid, uuid[]) to authenticated;

-- >>> 20261021000500_busqueda_clientes.sql
-- =============================================================================
-- Barber Suites · 005 · Búsqueda de clientes sin acentos
-- "maria" encuentra a "María". Se añade la columna search_name a la vista.
-- =============================================================================

create extension if not exists unaccent with schema extensions;

-- unaccent() no es IMMUTABLE; este envoltorio fija el diccionario.
create or replace function public.unaccent_lower(p text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(p, '')));
$$;

create or replace view public.admin_customers
with (security_invoker = true)
as
select
  b.customer_phone                                                      as phone,
  (array_agg(b.customer_name order by b.created_at desc))[1]            as name,
  (array_agg(b.customer_email order by b.created_at desc)
     filter (where b.customer_email is not null))[1]                    as email,
  count(*)                                                              as total_bookings,
  count(*) filter (where b.status = 'completada')                       as completed,
  count(*) filter (where b.status = 'no_asistio')                       as no_shows,
  count(*) filter (where b.status = 'cancelada')                        as cancelled,
  coalesce(sum(b.price_usd) filter (where b.status = 'completada'), 0)  as total_spent_usd,
  max(b.starts_at) filter (where b.status = 'completada')               as last_visit,
  min(b.starts_at) filter (where b.status in ('pendiente', 'confirmada')
                             and b.starts_at > now())                   as next_booking,
  min(b.created_at)                                                     as first_seen,
  public.unaccent_lower(string_agg(distinct b.customer_name, ' '))      as search_name
from public.bookings b
group by b.customer_phone;

revoke all on public.admin_customers from anon;
grant select on public.admin_customers to authenticated;

-- >>> seed.sql
-- =============================================================================
-- Barber Suites · Datos de EJEMPLO
-- ⚠️ PENDIENTE: nombres, fotos, servicios, precios (USD) y horarios son de
-- ejemplo. El dueño debe reemplazarlos desde el panel /admin.
-- Lo único confirmado: martes de 9:00 a. m. a 6:00 p. m.
-- =============================================================================

-- Barberos de ejemplo
insert into public.barbers (id, name, bio, active, sort_order) values
  ('11111111-1111-4111-8111-111111111111', 'Barbero 1 (ejemplo)', 'Especialista en fades y degradados. Texto de ejemplo.', true, 1),
  ('22222222-2222-4222-8222-222222222222', 'Barbero 2 (ejemplo)', 'Cortes clásicos y arreglo de barba. Texto de ejemplo.', true, 2),
  ('33333333-3333-4333-8333-333333333333', 'Barbero 3 (ejemplo)', 'Color, decoloración y estilos modernos. Texto de ejemplo.', true, 3)
on conflict (id) do nothing;

-- Servicios de ejemplo (precios en USD, PENDIENTES de confirmar)
insert into public.services (id, name, description, duration_min, price_usd, active, sort_order) values
  ('aaaaaaa1-0000-4000-8000-000000000001', 'Corte clásico',        'Corte a tijera o máquina con acabado y peinado.', 30, 10.00, true, 1),
  ('aaaaaaa2-0000-4000-8000-000000000002', 'Fade / degradado',     'Degradado bajo, medio o alto con perfilado.',     45, 12.00, true, 2),
  ('aaaaaaa3-0000-4000-8000-000000000003', 'Corte + barba',        'Corte completo más arreglo y perfilado de barba.', 60, 15.00, true, 3),
  ('aaaaaaa4-0000-4000-8000-000000000004', 'Decoloración / color', 'Platinado, mechas o color. Incluye corte.',       120, 35.00, true, 4)
on conflict (id) do nothing;

-- Qué hace cada barbero
insert into public.barber_services (barber_id, service_id) values
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaa1-0000-4000-8000-000000000001'),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaa2-0000-4000-8000-000000000002'),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaa3-0000-4000-8000-000000000003'),
  ('22222222-2222-4222-8222-222222222222', 'aaaaaaa1-0000-4000-8000-000000000001'),
  ('22222222-2222-4222-8222-222222222222', 'aaaaaaa2-0000-4000-8000-000000000002'),
  ('22222222-2222-4222-8222-222222222222', 'aaaaaaa3-0000-4000-8000-000000000003'),
  ('33333333-3333-4333-8333-333333333333', 'aaaaaaa1-0000-4000-8000-000000000001'),
  ('33333333-3333-4333-8333-333333333333', 'aaaaaaa2-0000-4000-8000-000000000002'),
  ('33333333-3333-4333-8333-333333333333', 'aaaaaaa4-0000-4000-8000-000000000004')
on conflict do nothing;

-- Horarios de ejemplo (0 = domingo … 6 = sábado)
-- Barberos 1 y 2: martes a sábado, 9:00–13:00 y 14:00–18:00 (pausa de almuerzo)
-- Barbero 3: lunes a viernes, 10:00–18:00 corrido
insert into public.working_hours (barber_id, weekday, start_time, end_time)
select b.id, d.weekday, blk.start_time, blk.end_time
from (values
  ('11111111-1111-4111-8111-111111111111'::uuid),
  ('22222222-2222-4222-8222-222222222222'::uuid)
) as b(id)
cross join generate_series(2, 6) as d(weekday)
cross join (values ('09:00'::time, '13:00'::time), ('14:00'::time, '18:00'::time)) as blk(start_time, end_time)
where not exists (select 1 from public.working_hours w where w.barber_id = b.id);

insert into public.working_hours (barber_id, weekday, start_time, end_time)
select '33333333-3333-4333-8333-333333333333'::uuid, d.weekday, '10:00'::time, '18:00'::time
from generate_series(1, 5) as d(weekday)
where not exists (
  select 1 from public.working_hours w where w.barber_id = '33333333-3333-4333-8333-333333333333'
);
