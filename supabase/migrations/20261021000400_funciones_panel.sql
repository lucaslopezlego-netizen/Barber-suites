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
