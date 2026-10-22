import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getSetupStatus, needsSetup } from "@/lib/setup/status";
import { SetupForm } from "./SetupForm";

export const metadata: Metadata = { title: "Configurar el panel", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ConfigurarPage() {
  const status = await getSetupStatus();
  if (status.connected && !needsSetup(status)) redirect("/admin/login");

  return (
    <main className="grid min-h-dvh place-items-center bg-surface px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Image src="/logo.png" alt="Barber Suites" width={88} height={88} className="mx-auto" priority />
          <h1 className="mt-5 text-2xl font-bold">Crea tu acceso al panel</h1>
          <p className="mt-1 text-sm text-muted">Solo se hace una vez. Este correo y esta clave serán los del encargado.</p>
        </div>
        {status.connected ? (
          <SetupForm installs={!status.dbReady} />
        ) : (
          <div role="alert" className="card space-y-2 p-6 text-sm">
            <p className="font-semibold text-onyx">El panel todavía no está conectado a la base de datos.</p>
            <p className="text-muted">En Vercel, agrega Supabase en Storage, conéctalo a este proyecto y vuelve a publicar (Redeploy).</p>
          </div>
        )}
      </div>
    </main>
  );
}
