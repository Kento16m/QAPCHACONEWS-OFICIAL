import { useId, useState, type PointerEvent } from "react";
import type { DayReads } from "../lib/series";

const WIDTH = 800;
const HEIGHT = 240;
const number = new Intl.NumberFormat("es-PY");

const niceMax = (value: number) => {
  if (value <= 4) return 4;
  const step = 10 ** Math.floor(Math.log10(value));
  const multiple = [1, 2, 5, 10].find((candidate) => candidate * step >= value) ?? 10;
  return multiple * step;
};

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
  const line = rows
    .map((row, index) => `${index === 0 ? "M" : "L"}${xOf(index)} ${yOf(row.reads)}`)
    .join(" ");
  const area = `${line} L${WIDTH} ${HEIGHT} L0 ${HEIGHT} Z`;
  const ticks = [1, 0.75, 0.5, 0.25, 0];
  const labelEvery = Math.max(1, Math.ceil(rows.length / 7));

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
      <div aria-hidden className="ml-11 mt-1.5 flex justify-between whitespace-nowrap text-xs text-muted-foreground max-sm:[&>*:nth-child(even)]:hidden">
        {rows
          .filter((_, index) => index % labelEvery === 0)
          .map((row) => (
            <span key={row.day}>{formatLabel(row.day)}</span>
          ))}
      </div>
      <details className="mt-3">
        <summary className="cursor-pointer text-[0.8125rem] text-muted-foreground">
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
