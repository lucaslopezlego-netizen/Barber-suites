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
