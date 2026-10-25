"use client";
import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import { Logo } from "@/components/ui/Logo";

// Same shell as MoneyMate: fixed sidebar on desktop, slide-over drawer on
// mobile. Mobile is the primary target, so the top bar is always reachable.
export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  // Escape closes the drawer (keyboard users, WCAG 2.1.2).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="hidden lg:flex">
        <Sidebar />
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-30 bg-brand-950/60 lg:hidden" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="fixed inset-y-0 left-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
            <Sidebar onClose={() => setOpen(false)} />
          </div>
        </>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="surface-dark lg:hidden flex items-center gap-2 px-2 py-2 bg-brand-950 shrink-0">
          <button
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            aria-expanded={open}
            className="p-2.5 rounded-xl hover:bg-white/10 text-white"
          >
            <Menu className="w-6 h-6" aria-hidden="true" />
          </button>
          <Logo tone="light" />
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-5xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
