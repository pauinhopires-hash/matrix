import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import {
  ShoppingCart,
  ClipboardList,
  History,
  Truck,
  CheckCircle2,
  ChevronRight,
  Plus,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/compras/")({
  head: () => ({ meta: [{ title: "Compras — Misturaria Control" }] }),
  component: ComprasHub,
});

function ComprasHub() {
  const { user } = useAuth();
  if (!user) return null;
  const isStaff = user.role === "admin" || user.role === "gerente";

  const itens: Array<{
    to: string;
    label: string;
    desc: string;
    Icon: typeof ShoppingCart;
    staff?: boolean;
  }> = [
    { to: "/compras/pedido", label: "Novo pedido", desc: "Solicitar itens de compra", Icon: Plus },
    {
      to: "/compras/historico",
      label: "Histórico",
      desc: "Seus pedidos e status",
      Icon: History,
    },
    {
      to: "/compras/lista",
      label: "Lista de compras",
      desc: "Itens pendentes por fornecedor",
      Icon: ClipboardList,
      staff: true,
    },
    {
      to: "/admin/fornecedores",
      label: "Fornecedores",
      desc: "Cadastro e contatos",
      Icon: Truck,
      staff: true,
    },
    {
      to: "/admin/requisicoes-compra",
      label: "Aprovar pedidos",
      desc: "Mudar status dos pedidos",
      Icon: CheckCircle2,
      staff: true,
    },
  ];

  const visiveis = itens.filter((i) => !i.staff || isStaff);

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <ShoppingCart className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold leading-tight">Compras</h1>
            <p className="text-xs text-muted-foreground">Pedidos, fornecedores e lista</p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {visiveis.map(({ to, label, desc, Icon }) => (
          <Link key={to} to={to} className="block">
            <Card className="transition active:scale-[0.99]">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-tight">{label}</p>
                  <p className="text-[11px] text-muted-foreground">{desc}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
