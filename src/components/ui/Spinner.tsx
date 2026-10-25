// Spinning ring. Decorative: wrap it in something that has text (see Loading).
export function Spinner({ className = "w-8 h-8 border-4" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 rounded-full border-brand-100 border-t-brand-700 animate-spin motion-reduce:animate-none ${className}`}
    />
  );
}

// Block loading state for lists/pages. role="status" so screen readers hear it.
export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div role="status" className="flex flex-col items-center justify-center gap-3 py-10 text-sm text-slate-600">
      <Spinner />
      {label}
    </div>
  );
}

// One-line loading state for small spots (a card's number, a form field).
export function InlineLoading({ label = "Loading…", className = "" }: { label?: string; className?: string }) {
  return (
    <p role="status" className={`flex items-center gap-2 min-h-11 text-sm text-slate-600 ${className}`}>
      <Spinner className="w-5 h-5 border-2" />
      {label}
    </p>
  );
}
