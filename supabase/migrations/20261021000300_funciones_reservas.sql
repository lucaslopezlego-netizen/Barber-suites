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
