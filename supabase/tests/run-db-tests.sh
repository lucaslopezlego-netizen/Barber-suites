#!/usr/bin/env bash
# Ejecuta las migraciones + seed + tests de base de datos sobre un Postgres local
# en una base de datos desechable.
#
# Uso:  npm run test:db
# Requiere: psql y un servidor Postgres (>= 15) con la extensión btree_gist.
# Conexión: variables estándar PGHOST / PGPORT / PGUSER / PGPASSWORD
# (por defecto se conecta como el usuario "postgres" por socket local).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DB="barber_suites_test_$$"
export PGUSER="${PGUSER:-postgres}"

psql_admin() { psql -X -q -v ON_ERROR_STOP=1 -d postgres "$@"; }
psql_test() { psql -X -q -v ON_ERROR_STOP=1 -d "$DB" "$@"; }

cleanup() { psql_admin -c "drop database if exists $DB with (force)" >/dev/null 2>&1 || true; }
trap cleanup EXIT

psql_admin -c "create database $DB" >/dev/null
# Sesión en UTC (como Supabase): demuestra que las reglas usan
# settings.timezone (America/Caracas) y no la zona de la sesión.
psql_admin -c "alter database $DB set timezone = 'UTC'" >/dev/null

echo "→ Supabase shim"
psql_test -f "$ROOT/supabase/tests/supabase_shim.sql" >/dev/null

for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "→ Migración $(basename "$f")"
  psql_test -f "$f" >/dev/null
done

echo "→ Seed"
psql_test -f "$ROOT/supabase/seed.sql" >/dev/null

echo "→ Tests"
psql_test -f "$ROOT/supabase/tests/db_tests.sql" 2>&1 | sed -e 's/^psql:[^:]*:[0-9]*: NOTICE:  /  /' -e 's/^NOTICE:  /  /'


echo "→ Concurrencia: dos clientes reservan el mismo turno a la vez"
SLOT="(((now() at time zone 'America/Caracas')::date + 9 + ((2 - extract(dow from (now() at time zone 'America/Caracas')::date + 9)::int + 7) % 7)) + time '15:00') at time zone 'America/Caracas'"
BOOK="select coalesce(r->>'error','OK') from (select public.create_booking_public('22222222-2222-4222-8222-222222222222','aaaaaaa1-0000-4000-8000-000000000001',$SLOT,'Concurrente','PHONE') r) x"
CONC_OUT="$(mktemp)"
# Sesión A reserva y tarda 2 s en confirmar la transacción; la B intenta lo mismo mientras tanto.
( psql_test -At -c "begin" -c "${BOOK/PHONE/04161111111}" -c "select pg_sleep(2)" -c "commit" | grep -E '^(OK|[A-Z_]+)$' > "$CONC_OUT" ) &
sleep 0.5
RESULT_B="$(psql_test -At -c "${BOOK/PHONE/04162222222}")"
wait
RESULT_A="$(cat "$CONC_OUT")"; rm -f "$CONC_OUT"
echo "  sesión A: $RESULT_A · sesión B: $RESULT_B"
if [[ "$RESULT_A" == "OK" && "$RESULT_B" == "SLOT_TAKEN" ]]; then
  echo "  ok  · solo una de las dos reservas simultáneas entra"
else
  echo "FALLO: concurrencia (esperado A=OK, B=SLOT_TAKEN)"; exit 1
fi
