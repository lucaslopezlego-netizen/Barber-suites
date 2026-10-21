import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 text-center">
      <div>
        <p className="eyebrow">Error 404</p>
        <h1 className="mt-3 text-3xl font-bold">Esta página no existe</h1>
        <Link href="/" className="btn-gold mt-8">
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}
