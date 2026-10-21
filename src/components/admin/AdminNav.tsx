"use client";

import { CalendarDays, Clock3, Ban, LayoutDashboard, LogOut, MoreHorizontal, Scissors, Settings, UserRound, Users, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "@/app/admin/actions";

const MAIN = [
  { href: "/admin", label: "Resumen", icon: LayoutDashboard },
  { href: "/admin/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/admin/clientes", label: "Clientes", icon: Users },
];
const MORE = [
  { href: "/admin/barberos", label: "Barberos", icon: UserRound },
  { href: "/admin/horarios", label: "Horarios", icon: Clock3 },
  { href: "/admin/bloqueos", label: "Bloqueos", icon: Ban },
  { href: "/admin/servicios", label: "Servicios", icon: Scissors },
  { href: "/admin/ajustes", label: "Ajustes", icon: Settings },
];

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

export function AdminNav({ email }: { email: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  const moreActive = MORE.some((m) => isActive(pathname, m.href));

  return (
    <>
      {/* Escritorio: barra lateral */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-page p-4 lg:flex">
        <Link href="/admin" className="mb-8 flex items-center gap-3 px-2">
          <Image src="/logo.png" alt="" width={36} height={36} />
          <span className="font-semibold">Panel Barber Suites</span>
        </Link>
        <nav className="flex flex-1 flex-col gap-1" aria-label="Panel">
          {[...MAIN, ...MORE].map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(pathname, href) ? "page" : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                isActive(pathname, href) ? "bg-surface-2 font-semibold text-onyx" : "text-muted hover:bg-surface-2 hover:text-fg"
              }`}
            >
              <Icon className="size-[18px]" /> {label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-line pt-4">
          <p className="truncate px-3 text-xs text-subtle">{email}</p>
          <form action={signOut}>
            <button className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted hover:bg-surface-2 hover:text-fg">
              <LogOut className="size-[18px]" /> Cerrar sesión
            </button>
          </form>
          <Link href="/" className="mt-1 block px-3 py-1 text-xs text-subtle hover:text-muted">
            Ver la web
          </Link>
        </div>
      </aside>

      {/* Móvil: barra inferior */}
      <nav
        aria-label="Panel"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-line bg-page/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      >
        {MAIN.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(pathname, href) ? "page" : undefined}
            className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${isActive(pathname, href) ? "text-gold" : "text-muted"}`}
          >
            <Icon className="size-[22px]" /> {label}
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${moreActive ? "text-gold" : "text-muted"}`}
        >
          <MoreHorizontal className="size-[22px]" /> Más
        </button>
      </nav>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Más opciones">
          <button type="button" aria-label="Cerrar" className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="animate-rise absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-line bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="mb-2 flex items-center justify-between px-2">
              <p className="text-sm text-subtle">{email}</p>
              <button type="button" onClick={() => setOpen(false)} className="grid size-9 place-items-center rounded-full hover:bg-surface-2" aria-label="Cerrar">
                <X className="size-5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {MORE.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={`flex flex-col items-center gap-2 rounded-2xl border p-4 text-sm font-medium ${
                    isActive(pathname, href) ? "border-onyx bg-surface text-onyx" : "border-line bg-page text-fg"
                  }`}
                >
                  <Icon className="size-6" /> {label}
                </Link>
              ))}
              <form action={signOut} className="contents">
                <button className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-page p-4 text-sm font-medium text-muted">
                  <LogOut className="size-6" /> Salir
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
