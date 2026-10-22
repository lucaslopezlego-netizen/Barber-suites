import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createSessionClient } from "@/lib/supabase/server";

/** Sesión actual y si el usuario es admin (memorizado por request). */
export const getAdminSession = cache(async () => {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, isAdmin: false };
  const { data } = await supabase.rpc("is_admin");
  return { supabase, user, isAdmin: data === true };
});

/** Para páginas y acciones del panel: exige un admin o redirige al login. */
export async function requireAdmin() {
  // Sin Supabase configurado no hay panel posible: el login lo explica.
  if (!isSupabaseConfigured()) redirect("/admin/login");
  const session = await getAdminSession();
  if (!session.user) redirect("/admin/login");
  if (!session.isAdmin) redirect("/admin/sin-acceso");
  return session as typeof session & { user: NonNullable<typeof session.user> };
}
