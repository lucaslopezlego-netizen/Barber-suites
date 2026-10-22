"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/admin/ui";
import { setupFirstAdmin } from "./actions";

export function SetupForm({ installs }: { installs: boolean }) {
  const [state, action] = useActionState(setupFirstAdmin, null);
  return (
    <form action={action} className="card space-y-4 p-6">
      <div>
        <label htmlFor="email" className="label">
          Correo del encargado
        </label>
        <input id="email" name="email" type="email" inputMode="email" autoComplete="username" required className="field" />
      </div>
      <div>
        <label htmlFor="password" className="label">
          Clave <span className="font-normal text-subtle">(mínimo 6 caracteres)</span>
        </label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={6} required className="field" />
      </div>
      <div>
        <label htmlFor="confirm" className="label">
          Repite la clave
        </label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={6} required className="field" />
      </div>
      {installs && (
        <p className="rounded-xl bg-surface p-3 text-xs text-muted">
          Al continuar también se prepara la base de datos con barberos, servicios y horarios de ejemplo, que luego cambias desde el panel. Tarda unos segundos.
        </p>
      )}
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full">Crear acceso y entrar</SubmitButton>
    </form>
  );
}
