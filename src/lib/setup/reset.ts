import "server-only";
import { pgClient } from "./install";
import { postgresUrl } from "./status";

/**
 * Restablecer el acceso al panel desde el código: al subir este número y publicar,
 * la próxima visita a /admin borra el usuario del encargado y vuelve a mostrar
 * "Crea tu acceso al panel". Los datos (citas, barberos, servicios…) no se tocan.
 */
export const ACCESS_RESET: number = 0;

const ENSURE_COLUMN = "alter table public.settings add column if not exists access_reset int not null default 0";

async function withClient(fn: (c: ReturnType<typeof pgClient>) => Promise<void>) {
  const raw = postgresUrl();
  if (!raw) return;
  const client = pgClient(raw);
  try {
    await client.connect();
    await client.query("begin");
    await fn(client);
    await client.query("commit");
  } catch (e) {
    await client.query("rollback").catch(() => {});
    console.error("[acceso]", e);
  } finally {
    await client.end().catch(() => {});
  }
}

/** Si el código pide un restablecimiento que la base aún no aplicó, borra el acceso actual. */
export async function applyAccessReset() {
  if (ACCESS_RESET === 0) return;
  await withClient(async (c) => {
    await c.query(ENSURE_COLUMN);
    const row = await c.query("select access_reset from public.settings limit 1 for update");
    if (!row.rows[0] || row.rows[0].access_reset >= ACCESS_RESET) return;
    await c.query("delete from auth.users where id in (select user_id from public.admins)");
    await c.query("delete from public.admins");
    await c.query("update public.settings set access_reset = $1", [ACCESS_RESET]);
  });
}

/** El acceso recién creado ya corresponde al restablecimiento actual. */
export async function markAccessCurrent() {
  if (ACCESS_RESET === 0) return;
  await withClient(async (c) => {
    await c.query(ENSURE_COLUMN);
    await c.query("update public.settings set access_reset = greatest(access_reset, $1)", [ACCESS_RESET]);
  });
}
