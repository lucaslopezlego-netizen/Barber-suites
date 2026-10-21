-- =============================================================================
-- Tests de base de datos: reglas de reserva, restricción anti doble reserva y
-- RLS. Se ejecutan con supabase/tests/run-db-tests.sh sobre un Postgres local.
-- Cualquier fallo aborta con un mensaje "FALLO: …".
-- =============================================================================
\set ON_ERROR_STOP on
\set QUIET on
\o /dev/null
set client_min_messages = warning;

-- Fecha local (Caracas) del próximo día de la semana `p_dow`, al menos 2 días
-- en el futuro, a la hora `p_time`, más `p_weeks` semanas.
create function pg_temp.at_local(p_dow int, p_time time, p_weeks int default 0)
returns timestamptz language sql stable as $$
  select ((d + p_time) at time zone 'America/Caracas')
  from (
    select base + ((p_dow - extract(dow from base)::int + 7) % 7) + 7 * p_weeks as d
    from (select (now() at time zone 'America/Caracas')::date + 2 as base) b
  ) x;
$$;

-- Reserva pública abreviada: devuelve el código de error o 'OK'
create function pg_temp.book(p_barber uuid, p_service uuid, p_at timestamptz, p_phone text default '04141234567', p_ip text default null)
returns text language sql as $$
  select coalesce(r ->> 'error', 'OK')
  from (select public.create_booking_public(p_barber, p_service, p_at, 'Cliente Test', p_phone, null, null, p_ip) as r) x;
$$;

create function pg_temp.eq(p_actual text, p_expected text, p_label text)
returns void language plpgsql as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'FALLO: % → esperado %, obtenido %', p_label, p_expected, p_actual;
  end if;
  raise notice 'ok  · %', p_label;
end;
$$;

set client_min_messages = notice;

-- IDs del seed
\set b1 '''11111111-1111-4111-8111-111111111111'''
\set b2 '''22222222-2222-4222-8222-222222222222'''
\set b3 '''33333333-3333-4333-8333-333333333333'''
\set corte '''aaaaaaa1-0000-4000-8000-000000000001'''
\set fade  '''aaaaaaa2-0000-4000-8000-000000000002'''
\set color '''aaaaaaa4-0000-4000-8000-000000000004'''

\echo '--- Teléfonos'
select pg_temp.eq(public.normalize_phone('0422-2522392'), '+584222522392', 'normaliza 0422-2522392');
select pg_temp.eq(public.normalize_phone('+58 (422) 252-2392'), '+584222522392', 'normaliza +58 (422) 252-2392');
select pg_temp.eq(public.normalize_phone('4222522392'), '+584222522392', 'normaliza 4222522392');
select pg_temp.eq(public.normalize_phone('584222522392'), '+584222522392', 'normaliza 584222522392');

\echo '--- Reservas válidas y solapamientos (martes, barbero 1)'
select pg_temp.eq(pg_temp.book(:b1, :corte, pg_temp.at_local(2, '10:00'), '04140000001'), 'OK', 'martes 10:00 corte');
select pg_temp.eq(pg_temp.book(:b1, :corte, pg_temp.at_local(2, '10:00'), '04140000002'), 'SLOT_TAKEN', 'mismo turno ⇒ ocupado');
select pg_temp.eq(pg_temp.book(:b1, :fade,  pg_temp.at_local(2, '09:30'), '04140000002'), 'SLOT_TAKEN', '9:30 fade (45 min) pisa las 10:00 ⇒ ocupado');
select pg_temp.eq(pg_temp.book(:b1, :corte, pg_temp.at_local(2, '10:15'), '04140000002'), 'SLOT_TAKEN', 'solape parcial 10:15 ⇒ ocupado');
select pg_temp.eq(pg_temp.book(:b1, :corte, pg_temp.at_local(2, '10:30'), '04140000002'), 'OK', 'turno contiguo 10:30 (sin margen) ⇒ OK');
select pg_temp.eq(pg_temp.book(:b2, :corte, pg_temp.at_local(2, '10:00'), '04140000003'), 'OK', 'otro barbero a la misma hora ⇒ OK');

\echo '--- Margen entre citas'
update public.settings set buffer_min = 10 where id = 1;
select pg_temp.eq(pg_temp.book(:b1, :corte, pg_temp.at_local(2, '11:00'), '04140000004'), 'OK', 'con margen 10: 11:00 tras cita que acaba 11:00 (creada sin margen) ⇒ OK');
select pg_temp.eq(pg_temp.book(:b1, :corte, pg_temp.at_local(2, '11:35'), '04140000005'), 'SLOT_TAKEN', 'con margen 10: 11:35 cae en el margen de la cita 11:00–11:30 ⇒ ocupado');
select pg_temp.eq(pg_temp.book(:b1, :corte, pg_temp.at_local(2, '11:40'), '04140000005'), 'OK', 'con margen 10: 11:40 ⇒ OK');
update public.settings set buffer_min = 0 where id = 1;

\echo '--- Bordes del horario'
select pg_temp.eq(pg_temp.book(:b1, :corte, pg_temp.at_local(2, '13:00'), '04140000006'), 'OUTSIDE_HOURS', '13:00 (almuerzo) ⇒ fuera de horario');
select pg_temp.eq(pg_temp.book(:b1, :fade,  pg_temp.at_local(2, '12:30'), '04140000006'), 'OUTSIDE_HOURS', '12:30 fade termina 13:15 ⇒ fuera de horario');
select pg_temp.eq(pg_temp.book(:b1, :corte, pg_temp.at_local(2, '12:30'), '04140000006'), 'OK', '12:30 corte termina justo 13:00 ⇒ OK');
select pg_temp.eq(pg_temp.book(:b1, :corte, pg_temp.at_local(2, '17:30'), '04140000007'), 'OK', '17:30 corte termina justo 18:00 ⇒ OK');
select pg_temp.eq(pg_temp.book(:b1, :corte, pg_temp.at_local(3, '17:45'), '04140000007'), 'OUTSIDE_HOURS', '17:45 corte termina 18:15 ⇒ fuera de horario');
select pg_temp.eq(pg_temp.book(:b1, :corte, pg_temp.at_local(3, '08:45'), '04140000007'), 'OUTSIDE_HOURS', '8:45 antes de abrir ⇒ fuera de horario');
select pg_temp.eq(pg_temp.book(:b1, :corte, pg_temp.at_local(1, '10:00'), '04140000007'), 'OUTSIDE_HOURS', 'lunes (barbero 1 no trabaja) ⇒ fuera de horario');
select pg_temp.eq(pg_temp.book(:b3, :corte, pg_temp.at_local(1, '10:00'), '04140000007'), 'OK', 'lunes barbero 3 ⇒ OK');

\echo '--- Servicios'
select pg_temp.eq(pg_temp.book(:b1, :color, pg_temp.at_local(3, '10:00'), '04140000008'), 'SERVICE_NOT_OFFERED', 'barbero 1 no hace color');
update public.services set active = false where id = :fade;
select pg_temp.eq(pg_temp.book(:b1, :fade, pg_temp.at_local(3, '10:00'), '04140000008'), 'INVALID_SERVICE', 'servicio inactivo');
update public.services set active = true where id = :fade;

\echo '--- Bloqueos'
insert into public.time_off (barber_id, starts_at, ends_at, reason)
values (:b2, pg_temp.at_local(3, '09:00'), pg_temp.at_local(3, '13:00'), 'Diligencia (test)');
select pg_temp.eq(pg_temp.book(:b2, :corte, pg_temp.at_local(3, '10:00'), '04140000009'), 'TIME_OFF', 'bloqueo del barbero 2');
select pg_temp.eq(pg_temp.book(:b2, :corte, pg_temp.at_local(3, '12:30'), '04140000009'), 'TIME_OFF', 'cita que empieza dentro del bloqueo');
select pg_temp.eq(pg_temp.book(:b2, :corte, pg_temp.at_local(3, '14:00'), '04140000009'), 'OK', 'después del bloqueo ⇒ OK');
select pg_temp.eq(pg_temp.book(:b1, :corte, pg_temp.at_local(3, '10:00'), '04140000010'), 'OK', 'el bloqueo del barbero 2 no afecta al 1');
insert into public.time_off (barber_id, starts_at, ends_at, reason)
values (null, pg_temp.at_local(4, '00:00'), pg_temp.at_local(5, '00:00'), 'Feriado (test)');
select pg_temp.eq(pg_temp.book(:b1, :corte, pg_temp.at_local(4, '10:00'), '04140000010'), 'TIME_OFF', 'bloqueo general (feriado) afecta a todos');

\echo '--- Anticipación y días máximos'
select pg_temp.eq(pg_temp.book(:b1, :corte, now() + interval '20 minutes', '04140000011'), 'TOO_SOON', 'menos de 1 h de anticipación');
select pg_temp.eq(pg_temp.book(:b1, :corte, pg_temp.at_local(2, '10:00', 6), '04140000011'), 'TOO_FAR', 'más de 30 días hacia adelante');

\echo '--- Cancelar libera el turno'
update public.bookings set status = 'cancelada'
where barber_id = :b1 and starts_at = pg_temp.at_local(2, '10:00');
select pg_temp.eq(pg_temp.book(:b1, :corte, pg_temp.at_local(2, '10:00'), '04140000012'), 'OK', 'turno cancelado vuelve a estar libre');

\echo '--- La base de datos rechaza solapes aunque se salte la función'
do $$
begin
  insert into public.bookings (barber_id, service_id, customer_name, customer_phone, starts_at, ends_at, blocked_until, price_usd)
  values ('11111111-1111-4111-8111-111111111111', 'aaaaaaa1-0000-4000-8000-000000000001', 'Directo', '+584140000013',
          pg_temp.at_local(2, '10:10'), pg_temp.at_local(2, '10:40'), pg_temp.at_local(2, '10:40'), 10);
  raise exception 'FALLO: se permitió un INSERT solapado directo';
exception when exclusion_violation then
  raise notice 'ok  · INSERT directo solapado rechazado por la restricción de exclusión';
end;
$$;

do $$
begin
  update public.bookings set status = 'confirmada'
  where barber_id = '11111111-1111-4111-8111-111111111111'
    and status = 'cancelada' and starts_at = pg_temp.at_local(2, '10:00');
  raise exception 'FALLO: se reactivó una cita cancelada encima de otra';
exception when exclusion_violation then
  raise notice 'ok  · reactivar una cancelada sobre un turno ocupado ⇒ rechazado';
end;
$$;

do $$
begin
  insert into public.working_hours (barber_id, weekday, start_time, end_time)
  values ('11111111-1111-4111-8111-111111111111', 2, '12:00', '15:00');
  raise exception 'FALLO: se permitió un bloque de horario solapado';
exception when exclusion_violation then
  raise notice 'ok  · bloques de horario solapados rechazados';
end;
$$;

\echo '--- Anti-spam'
select pg_temp.eq(pg_temp.book(:b2, :corte, pg_temp.at_local(5, '09:00'), '04249999999'), 'OK', 'spam: 1ª cita');
select pg_temp.eq(pg_temp.book(:b2, :corte, pg_temp.at_local(5, '10:00'), '04249999999'), 'OK', 'spam: 2ª cita');
select pg_temp.eq(pg_temp.book(:b2, :corte, pg_temp.at_local(5, '11:00'), '04249999999'), 'OK', 'spam: 3ª cita');
select pg_temp.eq(pg_temp.book(:b2, :corte, pg_temp.at_local(5, '12:00'), '04249999999'), 'TOO_MANY_BOOKINGS', 'spam: 4ª cita futura del mismo teléfono');
select pg_temp.eq(pg_temp.book(:b2, :corte, pg_temp.at_local(5, '12:00'), '04249999999'), 'TOO_MANY_BOOKINGS', 'spam: 5º intento');
select pg_temp.eq(pg_temp.book(:b2, :corte, pg_temp.at_local(5, '12:00'), '04249999999'), 'RATE_LIMIT', 'spam: 6º intento en 1 h ⇒ límite por teléfono');
select pg_temp.eq(pg_temp.book(:b3, :corte, now() + interval '5 minutes', '0414' || lpad(g::text, 7, '0'), 'ip-abc'), 'TOO_SOON', 'intento ' || g || ' desde la misma IP')
from generate_series(100, 107) g;
select pg_temp.eq(pg_temp.book(:b3, :corte, pg_temp.at_local(1, '15:00'), '04140000200', 'ip-abc'), 'RATE_LIMIT', '9º intento en 10 min desde la misma IP ⇒ límite por IP');

\echo '--- Datos de prueba para RLS'
insert into auth.users (id, email) values
  ('99999999-0000-4000-8000-000000000001', 'admin@test.local'),
  ('99999999-0000-4000-8000-000000000002', 'usuario@test.local');
insert into public.admins (user_id) values ('99999999-0000-4000-8000-000000000001');
update public.barbers set active = false where id = :b3;

\echo '--- RLS: público (anon)'
set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
select pg_temp.eq((select count(*) from public.bookings)::text, '0', 'anon no ve citas');
select pg_temp.eq((select count(*) from public.barbers)::text, '2', 'anon solo ve barberos activos');
select pg_temp.eq((select count(*) from public.services)::text, '4', 'anon ve servicios activos');
select pg_temp.eq((select count(*) from public.settings)::text, '0', 'anon no lee settings directamente');
select pg_temp.eq((select count(*) from public.working_hours)::text, '0', 'anon no lee horarios directamente');
select pg_temp.eq((select count(*) from public.time_off)::text, '0', 'anon no lee bloqueos');
select pg_temp.eq((select count(*) from public.admins)::text, '0', 'anon no ve admins');
select pg_temp.eq(
  (select (public.get_schedule_snapshot(now(), now() + interval '30 days'))::text ~* '(customer|phone|cliente|reason|Diligencia|0414)')::text,
  'false', 'snapshot público sin datos de clientes ni motivos');
select pg_temp.eq(
  (select jsonb_array_length(public.get_schedule_snapshot(now(), now() + interval '30 days') -> 'busy') > 0)::text,
  'true', 'snapshot público incluye rangos ocupados');
select pg_temp.eq((public.public_business_info() ->> 'business_name'), 'Barber Suites', 'info pública del negocio');
do $$
begin
  insert into public.barbers (name) values ('Intruso');
  raise exception 'FALLO: anon pudo crear un barbero';
exception when insufficient_privilege then
  raise notice 'ok  · anon no puede crear barberos';
end;
$$;
do $$
begin
  perform public.create_booking_public(null, null, null, null, null);
  raise exception 'FALLO: anon pudo llamar create_booking_public';
exception when insufficient_privilege then
  raise notice 'ok  · anon no puede llamar create_booking_public (solo el servidor)';
end;
$$;
do $$
begin
  perform count(*) from public.admin_customers;
  raise exception 'FALLO: anon pudo leer admin_customers';
exception when insufficient_privilege then
  raise notice 'ok  · anon no puede leer la vista de clientes';
end;
$$;
do $$
declare n int;
begin
  update public.bookings set status = 'cancelada';
  get diagnostics n = row_count;
  if n > 0 then raise exception 'FALLO: anon modificó citas'; end if;
  raise notice 'ok  · anon no puede modificar citas';
end;
$$;
reset role;

\echo '--- RLS: usuario autenticado que NO es admin'
set role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"99999999-0000-4000-8000-000000000002"}', false);
select pg_temp.eq((select count(*) from public.bookings)::text, '0', 'no-admin no ve citas');
select pg_temp.eq((select count(*) from public.admin_customers)::text, '0', 'no-admin no ve clientes');
select pg_temp.eq((select count(*) from public.barbers)::text, '2', 'no-admin solo ve barberos activos');
do $$
begin
  perform public.admin_create_booking('11111111-1111-4111-8111-111111111111', 'aaaaaaa1-0000-4000-8000-000000000001', now(), 'X', '04140000000');
  raise exception 'FALLO: no-admin creó una cita desde el panel';
exception when raise_exception then
  if sqlerrm <> 'FORBIDDEN' then raise; end if;
  raise notice 'ok  · no-admin no puede usar admin_create_booking';
end;
$$;
reset role;

\echo '--- RLS: admin'
set role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"99999999-0000-4000-8000-000000000001"}', false);
select pg_temp.eq(((select count(*) from public.bookings) > 0)::text, 'true', 'admin ve todas las citas');
select pg_temp.eq((select count(*) from public.barbers)::text, '3', 'admin ve también barberos inactivos');
select pg_temp.eq((select count(*) from public.settings)::text, '1', 'admin lee settings');
select pg_temp.eq(((select count(*) from public.admin_customers) > 0)::text, 'true', 'admin ve la vista de clientes');
select pg_temp.eq(
  (select total_bookings::text from public.admin_customers where phone = '+584249999999'), '3', 'clientes: agrupa citas por teléfono');
select pg_temp.eq(public.unaccent_lower('María Rodríguez'), 'maria rodriguez', 'búsqueda de clientes sin acentos');
select pg_temp.eq(
  (public.admin_create_booking(:b1, :corte, pg_temp.at_local(1, '19:00'), 'Sin cita', '0412 555 0000') ->> 'status'),
  'confirmada', 'admin crea cita fuera de horario (cliente sin cita previa)');
do $$
begin
  perform public.admin_create_booking('11111111-1111-4111-8111-111111111111', 'aaaaaaa1-0000-4000-8000-000000000001',
    pg_temp.at_local(1, '19:15'), 'Otro', '04125550001');
  raise exception 'FALLO: admin creó una cita solapada';
exception when raise_exception then
  if sqlerrm <> 'SLOT_TAKEN' then raise; end if;
  raise notice 'ok  · admin tampoco puede solapar citas';
end;
$$;
update public.bookings set status = 'completada' where customer_name = 'Sin cita';
select pg_temp.eq(
  (select status::text from public.bookings where customer_name = 'Sin cita'), 'completada', 'admin cambia estado de una cita');
update public.settings set slot_interval_min = 30 where id = 1;
select pg_temp.eq((select slot_interval_min::text from public.settings), '30', 'admin cambia ajustes');
select pg_temp.eq(public.admin_set_working_hours(:b3, '[{"weekday":1,"start_time":"09:00","end_time":"12:00"},{"weekday":1,"start_time":"13:00","end_time":"17:00"}]')::text, '2', 'admin reemplaza el horario semanal');
do $$
begin
  perform public.admin_set_working_hours('33333333-3333-4333-8333-333333333333', '[{"weekday":1,"start_time":"09:00","end_time":"12:00"},{"weekday":1,"start_time":"11:00","end_time":"17:00"}]');
  raise exception 'FALLO: horario solapado aceptado';
exception when raise_exception then
  if sqlerrm <> 'OVERLAP' then raise; end if;
  raise notice 'ok  · horario solapado rechazado (y el anterior se conserva)';
end;
$$;
select pg_temp.eq((select count(*) from public.working_hours where barber_id = :b3)::text, '2', 'el horario anterior sigue intacto tras el error');
select public.admin_set_barber_services(:b3, array[:corte]::uuid[]);
select pg_temp.eq((select count(*) from public.barber_services where barber_id = :b3)::text, '1', 'admin asigna servicios a un barbero');
reset role;

\echo '--- Panel: un no-admin no puede cambiar horarios'
set role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"99999999-0000-4000-8000-000000000002"}', false);
do $$
begin
  perform public.admin_set_working_hours('11111111-1111-4111-8111-111111111111', '[]');
  raise exception 'FALLO: no-admin cambió horarios';
exception when raise_exception then
  if sqlerrm <> 'FORBIDDEN' then raise; end if;
  raise notice 'ok  · no-admin no puede cambiar horarios';
end;
$$;
reset role;

\echo ''
\echo '✅ Todos los tests de base de datos pasaron'
