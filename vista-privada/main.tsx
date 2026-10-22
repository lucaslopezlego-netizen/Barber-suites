/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Eye, EyeOff } from "lucide-react";
import { ASSETS } from "./assets";
import { ACCESS_EMAIL, ACCESS_PASSWORD } from "./creds";
import { DemoAdmin } from "./DemoAdmin";
import { DemoHome } from "./DemoHome";
import { connectDb, installFetchMock, sync, useStore } from "./store";

installFetchMock();
void connectDb();

type Tab = "web" | "panel";
const initialTab = (): Tab => (location.hash === "#panel" ? "panel" : "web");

/** Pantalla de acceso: nada de la página se muestra hasta poner correo y clave. */
function Gate({ onOpen }: { onOpen: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="grid min-h-[90vh] place-items-center bg-surface px-4 py-12">
      <form
        className="w-full max-w-sm"
        onSubmit={(e) => {
          e.preventDefault();
          if (email.trim().toLowerCase() === ACCESS_EMAIL.toLowerCase() && password === ACCESS_PASSWORD) onOpen();
          else setError("Correo o clave incorrectos.");
        }}
      >
        <div className="mb-8 text-center">
          <img src={ASSETS.logo} alt="Barber Suites" width={96} height={96} className="mx-auto" />
          <h1 className="title-display mt-5 text-2xl">Barber Suites</h1>
          <p className="mt-1 text-sm text-muted">Escribe tu correo y tu clave para entrar.</p>
        </div>
        <div className="card space-y-4 p-6">
          <div>
            <label htmlFor="gate-email" className="label">
              Correo
            </label>
            <input id="gate-email" type="email" inputMode="email" autoComplete="username" required className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label htmlFor="gate-pass" className="label">
              Clave
            </label>
            <div className="relative">
              <input id="gate-pass" type={show ? "text" : "password"} autoComplete="current-password" required className="field pr-12" value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" onClick={() => setShow(!show)} className="absolute inset-y-0 right-0 grid w-12 place-items-center text-muted" aria-label={show ? "Ocultar clave" : "Mostrar clave"}>
                {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
              </button>
            </div>
          </div>
          {error && (
            <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm">
              {error}
            </p>
          )}
          <button type="submit" className="btn-primary w-full">
            Entrar
          </button>
        </div>
      </form>
    </div>
  );
}

function App() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const lock = () => setOpen(false);
    window.addEventListener("demo:lock", lock);
    return () => window.removeEventListener("demo:lock", lock);
  }, []);
  if (!open) return <Gate onOpen={() => setOpen(true)} />;
  return <Site />;
}

function Site() {
  const [tab, setTab] = useState<Tab>(initialTab);
  useEffect(() => {
    const onNav = (e: Event) => {
      const href = (e as CustomEvent<string>).detail;
      if (href.startsWith("/admin")) setTab("panel");
      else if (href === "/") {
        setTab("web");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    };
    const onHash = () => {
      if (location.hash === "#panel" || location.hash === "#web") setTab(initialTab());
    };
    window.addEventListener("demo:navigate", onNav);
    window.addEventListener("hashchange", onHash);
    return () => {
      window.removeEventListener("demo:navigate", onNav);
      window.removeEventListener("hashchange", onHash);
    };
  }, []);
  useEffect(() => window.scrollTo({ top: 0 }), [tab]);

  return (
    <>
      <div className="border-b border-line bg-onyx text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5 sm:px-6">
          <SyncNote />
          <div className="flex rounded-full bg-white/10 p-1 text-sm" role="tablist" aria-label="Qué ver">
            {(
              [
                ["web", "Web de clientes"],
                ["panel", "Panel del dueño"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={`rounded-full px-4 py-1.5 font-semibold transition ${tab === id ? "bg-white text-onyx" : "text-white/80 hover:text-white"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {tab === "web" ? <DemoHome /> : <DemoAdmin />}
    </>
  );
}

function SyncNote() {
  useStore();
  const text = {
    conectando: "Conectando con el almacenamiento…",
    guardado: "Barber Suites, página privada. Las reservas y cambios quedan guardados.",
    "sin-guardar": "Abre esta página desde Claude para que los cambios se guarden.",
    error: "No se pudo guardar el último cambio. Revisa tu conexión y vuelve a intentarlo.",
  }[sync.status];
  return <p className={`text-xs ${sync.status === "error" ? "text-[#ffb4a6]" : "text-white/75"}`}>{text}</p>;
}

createRoot(document.getElementById("root")!).render(<App />);
