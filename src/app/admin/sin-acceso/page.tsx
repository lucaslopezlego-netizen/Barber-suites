import { ShieldAlert } from "lucide-react";
import { signOut } from "../actions";

export default function NoAccessPage() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 text-center">
      <div className="max-w-sm">
        <ShieldAlert className="mx-auto size-10 text-warn" />
        <h1 className="mt-4 text-2xl font-bold">Sin acceso al panel</h1>
        <p className="mt-2 text-muted">Tu usuario existe, pero no está autorizado como administrador. Pide al dueño que te dé acceso.</p>
        <form action={signOut} className="mt-6">
          <button className="btn-secondary">Cerrar sesión</button>
        </form>
      </div>
    </main>
  );
}
