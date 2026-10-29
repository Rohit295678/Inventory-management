"use client";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { iconButtonClass } from "@/components/ui/styles";

type Props = { title: string; onClose: () => void; children: React.ReactNode };

// Pop-up over the page, on the native <dialog>: focus stays inside, Esc and
// the backdrop close it, and the page behind keeps its state (typed amounts).
export function Modal({ title, onClose, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()} // click on the backdrop
      className="m-auto w-[calc(100%-1.5rem)] max-w-3xl max-h-[92vh] rounded-3xl bg-canvas p-0 shadow-2xl backdrop:bg-brand-900/50"
    >
      <div className="sticky top-0 z-20 flex items-center justify-between gap-2 bg-canvas/95 backdrop-blur pl-5 pr-2 py-2 border-b border-line">
        <h2 className="font-semibold text-slate-900 truncate">{title}</h2>
        <button type="button" onClick={onClose} className={iconButtonClass.edit} aria-label="Close">
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>
      <div className="p-3 sm:p-5">{children}</div>
    </dialog>
  );
}
