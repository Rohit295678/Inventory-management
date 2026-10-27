// Shared Tailwind class strings. Only theme tokens (brand/accent/line/...) and
// neutral slate are used, so recolouring happens in globals.css alone.
// Shapes follow the theme: pill buttons/inputs, soft rounded cards.
// Controls are >=44px tall for touch targets.

export const inputClass =
  "w-full min-h-11 px-4 py-2 border border-line rounded-full bg-white text-slate-900 " +
  "focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-brand-600 disabled:bg-canvas";

export const labelClass = "block text-sm font-medium text-slate-700 mb-1 ml-1";

export const cardClass = "bg-white rounded-3xl border border-line";

const buttonBase =
  "inline-flex items-center justify-center gap-2 min-h-11 px-5 rounded-full font-medium text-sm transition " +
  "motion-reduce:transition-none disabled:opacity-50";

export const buttonClass = {
  primary: `${buttonBase} bg-brand-700 hover:bg-brand-800 text-white`,
  secondary: `${buttonBase} bg-white border border-line text-brand-800 hover:bg-brand-50`,
  danger: `${buttonBase} text-red-700 hover:bg-red-50`,
} as const;

// Small round icon buttons (edit, delete, close). Always give them an aria-label.
const iconBase = "p-2.5 rounded-full transition motion-reduce:transition-none";
export const iconButtonClass = {
  edit: `${iconBase} text-brand-700 hover:bg-brand-50`,
  danger: `${iconBase} text-red-700 hover:bg-red-50`,
} as const;

// Pill toggles: tabs and quick date ranges. Active = solid teal, else outlined.
export function chipClass(active: boolean): string {
  return `min-h-11 px-5 rounded-full text-sm font-medium whitespace-nowrap border transition motion-reduce:transition-none ${
    active ? "bg-brand-700 text-white border-brand-700" : "bg-white text-brand-800 border-line hover:bg-brand-50"
  }`;
}
