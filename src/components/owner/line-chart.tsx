"use client";

import { useEffect, useId, useRef, useState } from "react";

export interface Series {
  name: string;
  /** CSS colour, e.g. "var(--series-1)". */
  color: string;
  values: number[];
}

const H = 240;
const PAD = { top: 12, right: 64, bottom: 28, left: 44 };
const nf = new Intl.NumberFormat("en-IN");
const dayFmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const fmtDay = (d: string) => dayFmt.format(new Date(`${d}T00:00:00Z`));

/** A "nice" axis maximum and 3–5 ticks. */
function ticks(max: number): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
}

/**
 * Daily lines with one y-axis, recessive grid, end-of-line labels, a legend, a hover
 * crosshair with tooltip, and a table view for screen readers and exact numbers.
 */
export function LineChart({
  dates,
  series,
  label,
}: {
  dates: string[];
  series: Series[];
  label: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  const [hover, setHover] = useState<number | null>(null);
  const tableId = useId();

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = dates.length;
  const yTicks = ticks(Math.max(1, ...series.flatMap((s) => s.values)));
  const yMax = yTicks.at(-1)!;
  const innerW = w - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (v / yMax) * innerH;
  const xLabelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(innerW / 80))));

  function onMove(clientX: number) {
    const rect = wrap.current?.getBoundingClientRect();
    if (!rect || n === 0) return;
    const px = clientX - rect.left - PAD.left;
    const i = Math.round((px / innerW) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  }

  // Keep end labels from overlapping.
  const ends = series.map((s) => ({ s, y: y(s.values.at(-1) ?? 0) })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) {
    if (ends[i].y - ends[i - 1].y < 14) ends[i].y = ends[i - 1].y + 14;
  }

  return (
    <figure className="flex flex-col gap-3">
      {series.length > 1 && (
        <ul className="flex flex-wrap gap-4 text-sm" aria-label="Legend">
          {series.map((s) => (
            <li key={s.name} className="flex items-center gap-2">
              <span
                className="h-0.5 w-4 rounded"
                style={{ background: s.color }}
                aria-hidden="true"
              />
              {s.name}
            </li>
          ))}
        </ul>
      )}
      <div
        ref={wrap}
        className="relative w-full touch-pan-y"
        onPointerMove={(e) => onMove(e.clientX)}
        onPointerDown={(e) => onMove(e.clientX)}
        onPointerLeave={() => setHover(null)}
      >
        <svg
          width={w}
          height={H}
          role="img"
          aria-label={label}
          aria-describedby={tableId}
          className="block"
        >
          {yTicks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={w - PAD.right}
                y1={y(t)}
                y2={y(t)}
                className="stroke-line"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 8}
                y={y(t)}
                dy="0.32em"
                textAnchor="end"
                className="fill-ink-muted text-[11px] tabular-nums"
              >
                {nf.format(t)}
              </text>
            </g>
          ))}
          {dates.map((d, i) =>
            i % xLabelEvery === 0 ? (
              <text
                key={d}
                x={x(i)}
                y={H - 8}
                textAnchor="middle"
                className="fill-ink-muted text-[11px]"
              >
                {fmtDay(d)}
              </text>
            ) : null,
          )}
          {series.map((s) => (
            <polyline
              key={s.name}
              points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          {ends.map(({ s, y: ly }) => (
            <text
              key={s.name}
              x={w - PAD.right + 6}
              y={ly}
              dy="0.32em"
              className="fill-ink text-[11px] font-medium"
            >
              {s.name}
            </text>
          ))}
          {hover != null && (
            <g>
              <line
                x1={x(hover)}
                x2={x(hover)}
                y1={PAD.top}
                y2={PAD.top + innerH}
                className="stroke-ink-muted"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              {series.map((s) => (
                <circle
                  key={s.name}
                  cx={x(hover)}
                  cy={y(s.values[hover] ?? 0)}
                  r={4.5}
                  fill={s.color}
                  className="stroke-surface"
                  strokeWidth={2}
                />
              ))}
            </g>
          )}
        </svg>
        {hover != null && (
          <div
            className="border-line bg-surface pointer-events-none absolute top-2 z-10 rounded-lg border px-3 py-2 text-xs shadow-md"
            style={{
              left: Math.min(Math.max(0, x(hover) + 12), w - 160),
            }}
          >
            <p className="font-semibold">{fmtDay(dates[hover])}</p>
            {series.map((s) => (
              <p key={s.name} className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5">
                  <span
                    className="size-2 rounded-full"
                    style={{ background: s.color }}
                    aria-hidden="true"
                  />
                  {s.name}
                </span>
                <span className="font-semibold tabular-nums">
                  {nf.format(s.values[hover] ?? 0)}
                </span>
              </p>
            ))}
          </div>
        )}
      </div>
      <details className="text-sm">
        <summary className="text-primary cursor-pointer font-medium">Show as table</summary>
        <div className="mt-2 max-h-72 overflow-auto">
          <table id={tableId} className="w-full text-left tabular-nums">
            <caption className="sr-only">{label}</caption>
            <thead>
              <tr className="text-ink-muted">
                <th className="py-1 pr-4 font-medium">Date</th>
                {series.map((s) => (
                  <th key={s.name} className="py-1 pr-4 font-medium">
                    {s.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dates.map((d, i) => (
                <tr key={d} className="border-line border-t">
                  <td className="py-1 pr-4">{fmtDay(d)}</td>
                  {series.map((s) => (
                    <td key={s.name} className="py-1 pr-4">
                      {nf.format(s.values[i] ?? 0)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
