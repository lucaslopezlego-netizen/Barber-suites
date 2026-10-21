import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { requireAdmin } from "@/lib/admin/auth";
import { blocksMinutes, formatDuration, formatRangeShort, WEEKDAY_SHORT } from "@/lib/tz";
import { HoursEditor } from "./HoursEditor";

export const metadata = { title: "Horarios" };

const ORDER = [1, 2, 3, 4, 5, 6, 0]; // lunes → domingo

interface Block {
  barber_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
}

export default async function HorariosPage({ searchParams }: { searchParams: Promise<{ barbero?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireAdmin();
  const [{ data: barbers }, { data: rows }] = await Promise.all([
    supabase.from("barbers").select("id, name, active").order("sort_order").order("name"),
    supabase.from("working_hours").select("barber_id, weekday, start_time, end_time").order("start_time"),
  ]);
  const list = barbers ?? [];
  const blocks: Block[] = (rows ?? []).map((r) => ({ ...r, start_time: r.start_time.slice(0, 5), end_time: r.end_time.slice(0, 5) }));
  const current = list.find((b) => b.id === sp.barbero) ?? list[0];
  const of = (barberId: string, weekday?: number) =>
    blocks.filter((b) => b.barber_id === barberId && (weekday === undefined || b.weekday === weekday));

  return (
    <>
      <PageHeader title="Horarios" subtitle="El horario fijo de cada semana. Para vacaciones o un día puntual usa Bloqueos." />

      {list.length === 0 ? (
        <p className="card p-8 text-center text-muted">Primero agrega un barbero en la sección Barberos.</p>
      ) : (
        <>
          {/* 1. Vista de toda la semana */}
          <section aria-labelledby="semana-title" className="mb-10">
            <h2 id="semana-title" className="mb-3 text-lg font-semibold">
              Semana del equipo
            </h2>
            {/* Celular: cada barbero con sus 7 días como casillas */}
            <ul className="card divide-y divide-line overflow-hidden md:hidden">
              {list.map((b) => {
                const selected = b.id === current?.id;
                return (
                  <li key={b.id}>
                    <Link
                      href={`/admin/horarios?barbero=${b.id}#editor`}
                      aria-current={selected ? "true" : undefined}
                      className={`block px-4 py-3.5 ${selected ? "bg-surface" : ""}`}
                    >
                      <span className="flex items-baseline justify-between gap-3">
                        <span className={`font-medium ${selected ? "font-semibold text-onyx" : "text-fg"}`}>
                          {b.name}
                          {!b.active && <span className="ml-1 text-xs font-normal text-subtle">(inactivo)</span>}
                        </span>
                        <span className="text-sm font-semibold tabular-nums">{formatDuration(blocksMinutes(of(b.id)))}</span>
                      </span>
                      <span className="mt-2 grid grid-cols-7 gap-1.5">
                        {ORDER.map((d) => {
                          const works = of(b.id, d).length > 0;
                          return (
                            <span
                              key={d}
                              title={`${WEEKDAY_SHORT[d]}: ${works ? of(b.id, d).map((x) => formatRangeShort(x.start_time, x.end_time)).join(" y ") : "libre"}`}
                              className={`grid h-8 place-items-center rounded-lg text-xs font-semibold ${
                                works ? "bg-onyx text-white" : "border border-line-strong text-subtle"
                              }`}
                            >
                              {WEEKDAY_SHORT[d].slice(0, 2)}
                            </span>
                          );
                        })}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>

            {/* Escritorio: tabla completa */}
            <div className="card hidden overflow-x-auto md:block">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-line text-subtle">
                  <tr>
                    <th scope="col" className="sticky left-0 bg-page px-4 py-3 font-medium">
                      Barbero
                    </th>
                    {ORDER.map((d) => (
                      <th key={d} scope="col" className="px-2 py-3 text-center font-medium">
                        {WEEKDAY_SHORT[d]}
                      </th>
                    ))}
                    <th scope="col" className="px-4 py-3 text-right font-medium">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {list.map((b) => {
                    const selected = b.id === current?.id;
                    return (
                      <tr key={b.id} className={selected ? "bg-surface" : "hover:bg-surface/60"}>
                        <th scope="row" className={`sticky left-0 px-4 py-3 font-medium ${selected ? "bg-surface" : "bg-page"}`}>
                          <Link
                            href={`/admin/horarios?barbero=${b.id}#editor`}
                            aria-current={selected ? "true" : undefined}
                            className={`whitespace-nowrap underline-offset-4 hover:underline ${selected ? "font-semibold text-onyx" : "text-fg"}`}
                          >
                            {b.name}
                          </Link>
                          {!b.active && <span className="ml-1 text-xs font-normal text-subtle">(inactivo)</span>}
                        </th>
                        {ORDER.map((d) => {
                          const day = of(b.id, d);
                          return (
                            <td key={d} className="px-2 py-3 text-center align-top">
                              {day.length === 0 ? (
                                <span className="text-subtle">Libre</span>
                              ) : (
                                <span className="flex flex-col gap-0.5 text-xs leading-snug whitespace-nowrap text-fg">
                                  {day.map((x) => (
                                    <span key={x.start_time}>{formatRangeShort(x.start_time, x.end_time)}</span>
                                  ))}
                                </span>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-4 py-3 text-right font-semibold whitespace-nowrap tabular-nums">{formatDuration(blocksMinutes(of(b.id)))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-subtle">Toca un barbero para cambiar su horario. En negro, los días que trabaja.</p>
          </section>

          {/* 2. Editor del barbero elegido */}
          {current && (
            <section id="editor" aria-labelledby="editor-title" className="scroll-mt-6">
              <h2 id="editor-title" className="mb-3 text-lg font-semibold">
                Horario de {current.name}
              </h2>
              <HoursEditor
                key={current.id}
                barberId={current.id}
                barberName={current.name}
                initial={of(current.id).map((h) => ({ weekday: h.weekday, start_time: h.start_time, end_time: h.end_time }))}
              />
            </section>
          )}
        </>
      )}
    </>
  );
}
