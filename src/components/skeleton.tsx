export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="bg-surface border-line h-14 animate-pulse rounded-xl border" />
      ))}
    </div>
  );
}
