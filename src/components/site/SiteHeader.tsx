import Image from "next/image";
import Link from "next/link";
import { BUSINESS } from "@/lib/business";
import { whatsappUrl } from "@/lib/phone";
import { WhatsAppIcon } from "@/components/ui/brand-icons";

const NAV = [
  { href: "/#servicios", label: "Servicios" },
  { href: "/#barberos", label: "Barberos" },
  { href: "/#trabajos", label: "Trabajos" },
  { href: "/#visitanos", label: "Horario y ubicación" },
];

export function SiteHeader({ whatsapp = BUSINESS.phone }: { whatsapp?: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-ink/80 backdrop-blur-xl supports-[backdrop-filter]:bg-ink/65">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3" aria-label={`${BUSINESS.name}, inicio`}>
          <Image src="/logo.png" alt="" width={40} height={40} priority className="size-10" />
          <span className="hidden font-display text-[15px] font-semibold tracking-[0.18em] whitespace-nowrap uppercase sm:inline">
            Barber <span className="text-gold">Suites</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-muted lg:flex" aria-label="Principal">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="transition hover:text-cream">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <a
            href={whatsappUrl(whatsapp, "¡Hola! Tengo una consulta.")}
            target="_blank"
            rel="noopener"
            aria-label="Escribir por WhatsApp"
            className="grid size-10 place-items-center rounded-full border border-line-strong text-cream transition hover:border-gold/60 hover:text-gold"
          >
            <WhatsAppIcon className="size-[18px]" />
          </a>
          <Link href="/reservar" className="btn-gold !px-5 !py-2.5 text-sm">
            Reservar
          </Link>
        </div>
      </div>
    </header>
  );
}
