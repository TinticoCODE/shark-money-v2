import Link from "next/link";
import {
  HandCoins,
  CreditCard,
  LayoutDashboard,
  PiggyBank,
  Receipt,
  Settings,
  Tags,
  Target,
  Wallet,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Inicio", icon: LayoutDashboard },
  { href: "/accounts", label: "Cuentas", icon: Wallet },
  { href: "/transactions", label: "Movs.", icon: Receipt },
  { href: "/loans", label: "Prést.", icon: HandCoins },
  { href: "/credit-cards", label: "Tarjetas", icon: CreditCard },
  { href: "/budgets", label: "Presup.", icon: PiggyBank },
  { href: "/goals", label: "Metas", icon: Target },
  { href: "/categories", label: "Categ.", icon: Tags },
  { href: "/settings", label: "Config.", icon: Settings },
];

interface AppShellProps {
  children: React.ReactNode;
  currentPath: string;
}

export function AppShell({ children, currentPath }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Shark Money
            </p>
            <h1 className="truncate text-sm font-semibold text-foreground">
              Finanzas personales
            </h1>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Link
              href="/settings"
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
              aria-label="Configuración"
            >
              <Settings className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-28 pt-6">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-6xl overflow-x-auto px-1 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-max gap-1 px-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPath.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex w-[4.5rem] shrink-0 flex-col items-center gap-1 rounded-lg px-1 py-2 text-[10px] font-medium transition-colors sm:w-auto sm:min-w-[4.75rem] sm:text-[11px]",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-center leading-tight">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}
