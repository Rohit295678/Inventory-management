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

  // print:* -> only the page content prints, flowing over as many pages as needed.
  return (
    <div className="flex h-screen overflow-hidden print:block print:h-auto print:overflow-visible">
      <div className="hidden lg:flex print:hidden">
        <Sidebar />
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-30 bg-brand-950/50 lg:hidden" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="fixed inset-y-0 left-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
            <Sidebar onClose={() => setOpen(false)} />
          </div>
        </>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden print:block print:overflow-visible">
        <header className="surface-dark lg:hidden print:hidden flex items-center gap-2 px-2 py-2 bg-nav shrink-0">
          <button
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            aria-expanded={open}
            className="p-2.5 rounded-full hover:bg-nav-hover text-on-nav"
          >
            <Menu className="w-6 h-6" aria-hidden="true" />
          </button>
          <Logo tone="light" />
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 print:overflow-visible print:p-0">
          <div className="max-w-5xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
