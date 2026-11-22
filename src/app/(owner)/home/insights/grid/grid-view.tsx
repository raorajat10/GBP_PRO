"use client";

import { useState } from "react";
import { rankTone, type PlaceResult } from "@/lib/rank/grid";

export interface ViewPoint {
  row: number;
  col: number;
  rank: number | null;
  results: PlaceResult[];
}

const TONE = {
  top: "bg-success text-white",
  mid: "bg-accent text-ink",
  low: "bg-danger text-white",
  none: "bg-paper text-ink-muted border-line border",
} as const;

/** The scan grid: one cell per point, coloured by your position there. Click for the full list. */
export function GridView({
  size,
  points,
  youPlaceId,
  businessName,
}: {
  size: number;
  points: ViewPoint[];
  youPlaceId: string;
  businessName: string;
}) {
  const center = Math.floor(size / 2);
  const [sel, setSel] = useState<{ row: number; col: number }>({ row: center, col: center });
  const at = (r: number, c: number) => points.find((p) => p.row === r && p.col === c);
  const chosen = at(sel.row, sel.col);
  const where = (r: number, c: number) => {
    if (r === center && c === center) return "your location";
    const ns = r < center ? "north" : r > center ? "south" : "";
    const ew = c < center ? "west" : c > center ? "east" : "";
    return `${ns}${ns && ew ? "-" : ""}${ew}`;
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,auto)_minmax(0,1fr)]">
      <div className="flex flex-col gap-3">
        <div
          role="grid"
          aria-label="Your Google position at each point of the grid. North is up."
          className="mx-auto grid w-full max-w-md gap-1.5"
          style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: size }, (_, r) =>
            Array.from({ length: size }, (_, c) => {
              const p = at(r, c);
              const rank = p?.rank ?? null;
              const isSel = sel.row === r && sel.col === c;
              return (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  role="gridcell"
                  aria-selected={isSel}
                  onClick={() => setSel({ row: r, col: c })}
                  aria-label={`${where(r, c)}: ${rank ? `position ${rank}` : "not in the top 20"}`}
                  className={`relative flex aspect-square items-center justify-center rounded-full text-sm font-bold tabular-nums transition-shadow sm:text-base ${TONE[rankTone(rank)]} ${
                    isSel ? "ring-ink ring-2 ring-offset-2 ring-offset-[var(--surface)]" : ""
                  }`}
                >
                  {rank ?? "20+"}
                  {r === center && c === center && (
                    <span className="bg-surface text-ink absolute -bottom-1 rounded-full px-1 text-[9px] leading-tight font-semibold">
                      you
                    </span>
                  )}
                </button>
              );
            }),
          )}
        </div>
        <ul
          className="text-ink-muted flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs"
          aria-label="Colour key"
        >
          <li className="flex items-center gap-1.5">
            <span className="bg-success size-3 rounded-full" aria-hidden="true" />
            1–3 (map pack)
          </li>
          <li className="flex items-center gap-1.5">
            <span className="bg-accent size-3 rounded-full" aria-hidden="true" />
            4–10
          </li>
          <li className="flex items-center gap-1.5">
            <span className="bg-danger size-3 rounded-full" aria-hidden="true" />
            11–20
          </li>
          <li className="flex items-center gap-1.5">
            <span className="border-line bg-paper size-3 rounded-full border" aria-hidden="true" />
            Not in top 20
          </li>
        </ul>
      </div>

      <div className="min-w-0" aria-live="polite">
        <p className="font-semibold">
          Searching from {where(sel.row, sel.col)}
          {chosen?.rank ? `, you're #${chosen.rank}` : ", you're not in the top 20"}
        </p>
        {chosen?.results.length ? (
          <ol className="mt-2 flex flex-col gap-1 text-sm">
            {chosen.results.slice(0, 10).map((r, i) => {
              const you = r.placeId === youPlaceId;
              return (
                <li
                  key={r.placeId}
                  className={`flex items-baseline gap-3 rounded-lg px-2 py-1.5 ${you ? "bg-primary-soft font-semibold" : ""}`}
                >
                  <span className="text-ink-muted w-6 shrink-0 text-right tabular-nums">
                    {i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate">{you ? `${businessName} (you)` : r.name}</span>
                    {r.address && !you && (
                      <span className="text-ink-muted block truncate text-xs font-normal">
                        {r.address}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="text-ink-muted mt-2 text-sm">No results were returned here.</p>
        )}
        {chosen?.rank && chosen.rank > 10 && (
          <p className="text-ink-muted mt-2 text-sm">
            Showing the top 10. You&apos;re further down at #{chosen.rank}.
          </p>
        )}
      </div>
    </div>
  );
}
