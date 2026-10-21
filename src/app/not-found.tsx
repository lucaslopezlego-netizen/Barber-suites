import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 text-center">
      <div>
        <h1 className="text-3xl font-bold">Esta página no existe</h1>
        <p className="mt-2 text-muted">Revisa la dirección o vuelve al inicio.</p>
        <Link href="/" className="btn-gold mt-8">
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}
