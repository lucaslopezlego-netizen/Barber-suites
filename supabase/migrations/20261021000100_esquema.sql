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
