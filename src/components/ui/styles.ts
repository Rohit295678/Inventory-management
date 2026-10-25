// Shared Tailwind class strings. Colours picked for WCAG AA contrast on white
// (emerald-700 / gray-600+), and controls are ≥44px tall for touch targets.

export const inputClass =
  "w-full min-h-11 px-3 py-2 border border-gray-300 rounded-xl bg-white text-gray-900 " +
  "focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:bg-gray-100";

export const labelClass = "block text-sm font-medium text-gray-700 mb-1";

export const cardClass = "bg-white rounded-2xl border border-gray-200 shadow-sm";

const buttonBase =
  "inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-xl font-semibold text-sm transition disabled:opacity-50";

export const buttonClass = {
  primary: `${buttonBase} bg-emerald-700 hover:bg-emerald-800 text-white`,
  secondary: `${buttonBase} bg-white border border-gray-300 text-gray-800 hover:bg-gray-50`,
  danger: `${buttonBase} text-red-700 hover:bg-red-50`,
} as const;
