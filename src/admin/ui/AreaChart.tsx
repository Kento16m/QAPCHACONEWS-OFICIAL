import { useId, useState, type PointerEvent } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { axisTicks, niceMax, smoothPath, type DayReads } from "../lib/series";

const WIDTH = 800;
const HEIGHT = 240;
const number = new Intl.NumberFormat("es-PY");

export function AreaChart({
  rows,
  formatLabel,
  summary,
}: {
  rows: DayReads[];
  formatLabel: (day: string) => string;
  summary: string;
}) {
  const gradient = useId();
  const [hover, setHover] = useState<number | null>(null);
  const top = niceMax(Math.max(0, ...rows.map((row) => row.reads)));
  const xOf = (index: number) => (index / Math.max(1, rows.length - 1)) * WIDTH;
  const yOf = (reads: number) => HEIGHT - (reads / top) * HEIGHT;
  const line = smoothPath(rows.map((row, index) => ({ x: xOf(index), y: yOf(row.reads) })));
  const area = `${line} L${WIDTH} ${HEIGHT} L0 ${HEIGHT} Z`;
  const ticks = [1, 0.75, 0.5, 0.25, 0];
  const dates = axisTicks(rows.length);

  const onMove = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - box.left) / box.width;
    setHover(Math.min(rows.length - 1, Math.max(0, Math.round(ratio * (rows.length - 1)))));
  };

  const active = hover === null ? null : rows[hover];

  return (
    <figure>
      <figcaption className="sr-only">{summary}</figcaption>
      <div className="flex gap-2">
        <div
          aria-hidden
          className="flex w-9 shrink-0 flex-col justify-between text-right text-xs text-muted-foreground"
        >
          {ticks.map((tick) => (
            <span key={tick}>{number.format(Math.round(top * tick))}</span>
          ))}
        </div>
        <div
          aria-hidden
          className="relative h-60 min-w-0 flex-1"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            preserveAspectRatio="none"
            className="absolute inset-0 size-full overflow-visible"
          >
            <defs>
              <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--primary)" stopOpacity="0.28" />
                <stop offset="1" stopColor="var(--primary)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {ticks.map((tick) => (
              <line
                key={tick}
                x1="0"
                x2={WIDTH}
                y1={HEIGHT * (1 - tick)}
                y2={HEIGHT * (1 - tick)}
                stroke="var(--border)"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            <path d={area} fill={`url(#${gradient})`} />
            <path
              d={line}
              fill="none"
              stroke="var(--primary)"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          {active && hover !== null && (
            <>
              <span
                className="absolute w-px bg-input"
                style={{ left: `${(xOf(hover) / WIDTH) * 100}%`, top: 0, bottom: 0 }}
              />
              <span
                className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-primary"
                style={{
                  left: `${(xOf(hover) / WIDTH) * 100}%`,
                  top: `${(yOf(active.reads) / HEIGHT) * 100}%`,
                }}
              />
              <span
                className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border bg-card px-2.5 py-1 text-xs shadow-sm"
                style={{ left: `${Math.min(88, Math.max(12, (xOf(hover) / WIDTH) * 100))}%` }}
              >
                {formatLabel(active.day)}:{" "}
                <span className="font-semibold">{number.format(active.reads)}</span>
              </span>
            </>
          )}
        </div>
      </div>
      <div aria-hidden className="relative ml-11 mt-1.5 h-4 text-xs text-muted-foreground">
        {dates.map((index, position) => {
          const fromEnd = dates.length - 1 - position;
          return (
            <span
              key={index}
              className={cn(
                "absolute whitespace-nowrap",
                position === 0 ? "" : fromEnd === 0 ? "-translate-x-full" : "-translate-x-1/2",
                // On a phone there is room for every other date, counting from today.
                fromEnd % 2 === 1 && "max-sm:hidden",
              )}
              style={{ left: `${(xOf(index) / WIDTH) * 100}%` }}
            >
              {formatLabel(rows[index]?.day ?? "")}
            </span>
          );
        })}
      </div>
      <details className="group mt-3">
        <summary className="flex w-fit cursor-pointer list-none items-center gap-1 text-[0.8125rem] text-muted-foreground [&::-webkit-details-marker]:hidden">
          <ChevronRight
            className="size-3.5 transition-transform duration-150 group-open:rotate-90"
            aria-hidden
          />
          Ver como tabla
        </summary>
        <table className="mt-2 w-full max-w-sm text-left text-[0.8125rem]">
          <thead className="text-muted-foreground">
            <tr>
              <th scope="col" className="py-1 font-normal">
                Fecha
              </th>
              <th scope="col" className="py-1 text-right font-normal">
                Lecturas
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.day} className="border-t">
                <td className="py-1">{formatLabel(row.day)}</td>
                <td className="py-1 text-right">{number.format(row.reads)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
