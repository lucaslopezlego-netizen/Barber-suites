import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";
import { postgresUrl } from "./status";

/** Conexión directa a Postgres. Supabase exige SSL; el parámetro sslmode de la URL se reemplaza por la opción explícita. */
export function pgClient(raw: string) {
  const url = new URL(raw);
  url.searchParams.delete("sslmode");
  const local = ["localhost", "127.0.0.1"].includes(url.hostname);
  return new Client({ connectionString: url.toString(), ssl: local ? false : { rejectUnauthorized: false } });
}

/**
 * Crea tablas, seguridad, funciones y datos de ejemplo ejecutando
 * supabase/instalar-todo.sql (todas las migraciones + seed) en una transacción.
 */
export async function installDatabase() {
  const raw = postgresUrl();
  if (!raw) throw new Error("NO_POSTGRES_URL");
  const sql = await fs.readFile(path.join(process.cwd(), "supabase", "instalar-todo.sql"), "utf8");

  const client = pgClient(raw);
  await client.connect();
  try {
    await client.query("begin");
    await client.query(sql);
    await client.query("commit");
    // La API de Supabase (PostgREST) guarda en caché las tablas: que las vuelva a leer
    await client.query("notify pgrst, 'reload schema'");
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    await client.end();
  }
}
