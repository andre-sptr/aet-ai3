export function SkeletonText({
  lines = 3,
  className = "",
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-3 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          className="h-3 skeleton"
          style={{ width: `${100 - (i % 3) * 12}%` }}
        />
      ))}
    </div>
  );
}
export function SkeletonAvatar({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  return (
    <div
      className={`${size === "sm" ? "size-8" : size === "lg" ? "size-16" : "size-12"} skeleton rounded-lg`}
      aria-hidden="true"
    />
  );
}
export function SkeletonMessage() {
  return (
    <div
      className="flex items-start gap-3"
      role="status"
      aria-label="AET AI sedang menyusun jawaban"
    >
      <div className="size-7 skeleton shrink-0" />
      <div className="w-4/5 max-w-md pt-2">
        <SkeletonText />
        <span className="sr-only">Sedang menyusun jawaban...</span>
      </div>
    </div>
  );
}
export function SkeletonChatMode() {
  return (
    <div className="mode-grid" aria-label="Memuat mode AI" role="status">
      {[0, 1, 2].map((i) => (
        <div key={i} className="mode-card">
          <div className="size-11 skeleton mb-8" />
          <SkeletonText lines={4} />
        </div>
      ))}
    </div>
  );
}
export function SkeletonStats() {
  return (
    <div className="grid grid-cols-3 gap-4" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-20 skeleton" />
      ))}
    </div>
  );
}
export default function SkeletonCard({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div
      className={`bg-white rounded-xl border border-slate-200 p-6 ${className}`}
    >
      <SkeletonText />
    </div>
  );
}
