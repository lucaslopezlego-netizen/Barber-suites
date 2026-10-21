"use client";

import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useFormStatus } from "react-dom";
import type { ActionResult } from "@/lib/admin/types";

export function SubmitButton({ children, className = "btn-gold w-full sm:w-auto" }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? <Loader2 className="size-5 animate-spin" /> : null}
      {pending ? "Guardando…" : children}
    </button>
  );
}

export function FormMessage({ state }: { state: ActionResult | null }) {
  if (!state?.message) return null;
  return (
    <p
      role={state.ok ? "status" : "alert"}
      className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${
        state.ok ? "border-ok/40 bg-ok/10 text-cream" : "border-danger/40 bg-danger/10 text-cream"
      }`}
    >
      {state.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-danger" />}
      {state.message}
    </p>
  );
}
