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
