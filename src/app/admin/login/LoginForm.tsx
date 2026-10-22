"use client";

import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const supabase = createBrowserSupabase();
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        setError(
          error.message.toLowerCase().includes("invalid") ? "Email o contraseña incorrectos." : "No pudimos iniciar sesión. Inténtalo de nuevo.",
        );
        return;
      }
      // Navegación completa: evita que el navegador reutilice la versión de /admin
      // guardada antes de iniciar sesión (que redirigía otra vez al login).
      window.location.assign("/admin");
    } catch {
      setError("Sin conexión. Revisa tu internet.");
    } finally {
      setLoading(false);
    }
  }

  if (!isSupabaseConfigured()) {
    return (
      <div role="alert" className="card space-y-2 p-6 text-sm">
        <p className="font-semibold text-onyx">El panel todavía no está conectado a la base de datos.</p>
        <p className="text-muted">
          Falta conectar Supabase en Vercel (las variables NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY y
          SUPABASE_SERVICE_ROLE_KEY) y volver a publicar. Cuando esté conectado, aquí podrás entrar con tu correo y tu clave.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-4 p-6">
      <div>
        <label htmlFor="email" className="label">
          Email
        </label>
        <input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          required
          className="field"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="password" className="label">
          Contraseña
        </label>
        <div className="relative">
          <input
            id="password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            required
            className="field pr-12"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="absolute inset-y-0 right-0 grid w-12 place-items-center text-muted hover:text-fg"
            aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
          >
            {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm">
          {error}
        </p>
      )}
      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading && <Loader2 className="size-5 animate-spin" />}
        {loading ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
