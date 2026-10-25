"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { LayoutGrid, LogOut, Package, ShoppingCart, Truck, Users, X } from "lucide-react";
import { Logo } from "@/components/ui/Logo";

const NAV = [
  { href: "/dashboard", label: "Today", icon: LayoutGrid },
  { href: "/purchases", label: "Purchases (Buy)", icon: Truck },
  { href: "/sales", label: "Sales (Sell)", icon: ShoppingCart },
  { href: "/items", label: "Items & Stock", icon: Package },
  { href: "/parties", label: "People", icon: Users },
] as const;

export default function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user;

  return (
    <aside className="surface-dark w-72 shrink-0 bg-nav text-on-nav-muted flex flex-col h-screen sticky top-0">
      <div className="p-5 border-b border-white/15 flex items-center justify-between">
        <Logo tone="light" tagline="Inventory manager" />
        {onClose && (
          <button onClick={onClose} aria-label="Close menu" className="p-2.5 rounded-xl text-on-nav hover:bg-nav-active">
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        )}
      </div>

      <nav aria-label="Main" className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              aria-current={active ? "page" : undefined}
              className={`relative flex items-center gap-3 px-3 min-h-11 rounded-xl text-sm font-medium transition ${
                active ? "bg-nav-active text-on-nav" : "text-on-nav-muted hover:bg-nav-active/60 hover:text-on-nav"
              }`}
            >
              {active && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-full bg-accent-400" aria-hidden="true" />}
              <Icon className={`w-5 h-5 ${active ? "text-accent-400" : ""}`} aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/15">
        <div className="flex items-center gap-3 px-2 mb-2">
          <div
            className="w-9 h-9 rounded-full bg-accent-400 flex items-center justify-center text-brand-800 font-bold"
            aria-hidden="true"
          >
            {(user?.name ?? user?.email ?? "U")[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-on-nav truncate">{user?.name ?? "User"}</p>
            <p className="text-xs text-on-nav-muted truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full flex items-center gap-2 px-3 min-h-11 text-sm text-on-nav hover:bg-nav-active rounded-xl"
        >
          <LogOut className="w-4 h-4" aria-hidden="true" /> Sign out
        </button>
      </div>
    </aside>
  );
}
