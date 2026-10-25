// Shared Tailwind class strings. Only theme tokens (brand-*/accent-*) and
// neutral slate are used, so recolouring happens in globals.css alone.
// Controls are >=44px tall for touch targets.

export const inputClass =
  "w-full min-h-11 px-3 py-2 border border-slate-300 rounded-xl bg-white text-slate-900 " +
  "focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-brand-600 disabled:bg-slate-100";

export const labelClass = "block text-sm font-medium text-slate-700 mb-1";

export const cardClass = "bg-white rounded-2xl border border-slate-200 shadow-sm shadow-slate-900/5";

const buttonBase =
  "inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-xl font-semibold text-sm transition disabled:opacity-50";

export const buttonClass = {
  primary: `${buttonBase} bg-brand-700 hover:bg-brand-800 text-white shadow-sm`,
  secondary: `${buttonBase} bg-white border border-slate-300 text-brand-800 hover:bg-brand-50`,
  danger: `${buttonBase} text-red-700 hover:bg-red-50`,
} as const;

// Pill toggles: tabs, quick date ranges, price-mode switch.
export function chipClass(active: boolean): string {
  return `min-h-11 px-4 rounded-full text-sm font-medium whitespace-nowrap border transition ${
    active ? "bg-brand-700 text-white border-brand-700 shadow-sm" : "bg-white text-slate-800 border-slate-300 hover:bg-brand-50"
  }`;
}
