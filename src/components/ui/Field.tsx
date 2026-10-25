import { useId } from "react";
import { inputClass, labelClass } from "./styles";

// Label + control pair with proper htmlFor wiring. Renders an <input> by
// default; pass `children` as a render prop to supply a custom control
// (e.g. <select>), which receives the generated id.

type FieldProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "className" | "children"> & {
  label: string;
  hint?: string;
  className?: string;
  children?: (id: string) => React.ReactNode;
};

export function Field({ label, hint, className, children, ...inputProps }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const control = children ? (
    children(id)
  ) : (
    <input id={id} aria-describedby={hintId} className={inputClass} {...inputProps} />
  );

  return (
    <div className={className}>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {control}
      {hint && (
        <p id={hintId} className="mt-1 text-xs text-slate-600">
          {hint}
        </p>
      )}
    </div>
  );
}
