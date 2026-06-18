import { Link } from "@tanstack/react-router";
import { Home, ListChecks, Package, User as UserIcon, Shield, ShoppingCart } from "lucide-react";
import { useAuth } from "@/lib/auth";

export function BottomNav() {
  const { user } = useAuth();
  const isStaff = user?.role === "admin" || user?.role === "gerente";

  const items = [
    { to: "/dashboard", label: "Início", Icon: Home },
    { to: "/checklist/abertura", label: "Checks", Icon: ListChecks },
    { to: "/estoque", label: "Estoque", Icon: Package },
    { to: "/compras", label: "Compras", Icon: ShoppingCart },
    ...(isStaff ? [{ to: "/admin/usuarios", label: "Equipe", Icon: Shield }] : []),
    { to: "/perfil", label: "Perfil", Icon: UserIcon },
  ] as const;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <ul className="mx-auto flex max-w-md items-stretch justify-around px-2">
        {items.map(({ to, label, Icon }) => (
          <li key={to} className="flex-1">
            <Link
              to={to}
              className="flex flex-col items-center gap-1 py-3 text-xs text-muted-foreground transition-colors data-[status=active]:text-primary"
              activeProps={{ "data-status": "active" } as never}
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="h-[env(safe-area-inset-bottom)] bg-card" />
    </nav>
  );
}
