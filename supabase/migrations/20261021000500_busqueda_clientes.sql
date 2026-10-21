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
