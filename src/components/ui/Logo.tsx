import { Boxes } from "lucide-react";

// App wordmark. `tone` picks colours for light vs dark backgrounds.
export function Logo({ tone = "dark", size = "md", tagline }: { tone?: "dark" | "light"; size?: "md" | "lg"; tagline?: string }) {
  const big = size === "lg";
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`inline-flex items-center justify-center rounded-full bg-accent-400 text-brand-800 ${big ? "w-12 h-12" : "w-9 h-9"}`}
        aria-hidden="true"
      >
        <Boxes className={big ? "w-7 h-7" : "w-5 h-5"} />
      </span>
      <span>
        <span className={`block font-semibold tracking-tight ${big ? "text-3xl" : "text-xl"} ${tone === "light" ? "text-on-nav" : "text-brand-800"}`}>
          StockBook
        </span>
        {tagline && (
          <span className={`block text-xs ${tone === "light" ? "text-on-nav-muted" : "text-slate-600"}`}>{tagline}</span>
        )}
      </span>
    </div>
  );
}
