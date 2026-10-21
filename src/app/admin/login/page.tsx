import type { Metadata } from "next";
import Image from "next/image";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Acceso del equipo", robots: { index: false } };

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh bg-surface place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Image src="/logo.png" alt="Barber Suites" width={88} height={88} className="mx-auto" priority />
          <h1 className="mt-5 text-2xl font-bold">Panel de Barber Suites</h1>
          <p className="mt-1 text-sm text-muted">Entra con tu email y contraseña.</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
