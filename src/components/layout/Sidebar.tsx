"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  const router = useRouter();
  const { data: session } = useSession();
  const user = session?.user;

  // redirect:false + client navigation: NextAuth's own redirect would use
  // NEXTAUTH_URL (localhost), which on a phone points at the phone itself.
  async function handleSignOut() {
    await signOut({ redirect: false });
    router.replace("/login");
    router.refresh();
  }

  return (
    <aside className="surface-dark w-72 shrink-0 bg-nav text-on-nav-muted flex flex-col h-screen sticky top-0">
      <div className="p-5 border-b border-white/10 flex items-center justify-between">
        <Logo tone="light" tagline="Inventory manager" />
        {onClose && (
          <button onClick={onClose} aria-label="Close menu" className="p-2.5 rounded-full text-on-nav hover:bg-nav-hover">
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        )}
      </div>

      <nav aria-label="Main" className="flex-1 p-4 space-y-1.5 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 px-4 min-h-12 rounded-full text-sm font-medium transition motion-reduce:transition-none ${
                active ? "bg-nav-active text-on-nav-active" : "text-on-nav-muted hover:bg-nav-hover hover:text-on-nav"
              }`}
            >
              <Icon className="w-5 h-5" aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-2 mb-2">
          <div
            className="w-10 h-10 rounded-full bg-accent-400 flex items-center justify-center text-on-nav-active font-semibold"
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
          onClick={handleSignOut}
          className="w-full flex items-center gap-2 px-4 min-h-11 text-sm text-on-nav hover:bg-nav-hover rounded-full"
        >
          <LogOut className="w-4 h-4" aria-hidden="true" /> Sign out
        </button>
      </div>
    </aside>
  );
}
