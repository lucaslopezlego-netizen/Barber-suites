import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./env";

/** Clave secreta de Supabase (acepta los nombres que usa la integración de Vercel). */
export function serviceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
}

/**
 * Cliente con la clave service_role. SOLO para el servidor: crear reservas desde
 * la web y la configuración inicial del panel. Nunca importar desde un componente
 * de cliente.
 */
export function createServiceClient() {
  const key = serviceRoleKey();
  if (!SUPABASE_URL || !key) return null;
  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
