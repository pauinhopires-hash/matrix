import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  fetchItens,
  fetchRegistros,
  filterBySetor,
  groupBySetor,
  todayKey,
  CHECKLIST_META,
  qk as ckQk,
  type ChecklistTipo,
} from "@/lib/checklists-db";
import { fetchProdutos, qk as estoqueQk } from "@/lib/estoque-db";
import { fetchSaldos, qk as movQk, fmtQty } from "@/lib/movimentos-db";
import { StatusBadge, type Status } from "@/components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sunrise,
  Sun,
  Moon,
  Package,
  ChefHat,
  ShieldCheck,
  ShoppingCart,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Misturaria Control" }] }),
  component: Dashboard,
});

const ICONS = { Sunrise, Sun, Moon } as const;
const TIPOS: ChecklistTipo[] = ["abertura", "meio", "fechamento"];

function Dashboard() {
  const { user } = useAuth();

  const hoje = useMemo(() => todayKey(), []);
  const { data: itens = [] } = useQuery({
    queryKey: ckQk.itensAll,
    queryFn: () => fetchItens(),
  });
  const { data: registros = [] } = useQuery({
    queryKey: ckQk.registros(hoje),
    queryFn: () => fetchRegistros(hoje),
  });
  const { data: produtos = [] } = useQuery({
    queryKey: estoqueQk.produtos,
    queryFn: fetchProdutos,
  });
  const { data: saldos = [] } = useQuery({
    queryKey: movQk.saldos,
    queryFn: fetchSaldos,
  });

  if (!user) return null;
  const isStaff = user.role === "admin" || user.role === "gerente";
  const setorFilter = isStaff ? null : user.setor;

  // Saldos totais por produto (soma de todos os sublocais)
  const saldoTotalByProduto = new Map<string, number>();
  for (const s of saldos) {
    saldoTotalByProduto.set(
      s.produto_id,
      (saldoTotalByProduto.get(s.produto_id) ?? 0) + Number(s.quantidade),
    );
  }

  const alertas = produtos.filter(
    (p) => p.ativo && (saldoTotalByProduto.get(p.id) ?? 0) < Number(p.estoque_minimo),
  );

  const cards = TIPOS.map((tipo) => {
    const itensDoTipo = filterBySetor(
      itens.filter((i) => i.tipo === tipo),
      setorFilter,
    );
    const total = itensDoTipo.length;
    const done = itensDoTipo.filter((i) =>
      registros.find((r) => r.tipo === tipo && r.item_id === i.id && r.done),
    ).length;
    let status: Status = "idle";
    if (total > 0) status = done === total ? "done" : "pending";
    return { tipo, total, done, status };
  });

  // Garante referência usada
  void groupBySetor;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm text-muted-foreground">{greeting},</p>
        <h1 className="font-display text-2xl font-bold">{user.nome.split(" ")[0]}</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {user.cargo} · {user.setor}
          {isStaff && " · vendo todos os setores"}
        </p>
      </section>

      {alertas.length > 0 && (
        <Link to="/estoque" className="block">
          <Card className="border-destructive/40 bg-destructive/5 transition active:scale-[0.99]">
            <CardContent className="flex items-center gap-3 p-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-destructive">
                  {alertas.length} item(ns) abaixo do mínimo
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {alertas
                    .slice(0, 3)
                    .map(
                      (p) =>
                        `${p.nome} (${fmtQty(saldoTotalByProduto.get(p.id) ?? 0, p.unidade)})`,
                    )
                    .join(" · ")}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Checklists de hoje
        </h2>
        {cards.map(({ tipo, total, done, status }) => {
          const meta = CHECKLIST_META[tipo];
          const Icon = ICONS[meta.icon as keyof typeof ICONS];
          const pct = total === 0 ? 0 : Math.round((done / total) * 100);
          return (
            <Link
              key={tipo}
              to="/checklist/$tipo"
              params={{ tipo }}
              className="block"
            >
              <Card className="transition active:scale-[0.99]">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-display font-semibold">{meta.titulo}</p>
                      <StatusBadge status={status} />
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {total === 0
                        ? "Sem itens para o seu setor"
                        : `${done}/${total} concluídos`}
                    </p>
                    {total > 0 && (
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Módulos
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <Link to="/estoque" className="block">
            <Card className="transition active:scale-[0.99]">
              <CardContent className="flex flex-col items-start gap-2 p-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <Package className="h-4 w-4" />
                </div>
                <p className="text-sm font-medium">Estoque</p>
                <p className="text-[10px] text-muted-foreground">
                  Saldo, retiradas e porcionamento
                </p>
              </CardContent>
            </Card>
          </Link>
          <Link to="/compras" className="block">
            <Card className="transition active:scale-[0.99]">
              <CardContent className="flex flex-col items-start gap-2 p-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <ShoppingCart className="h-4 w-4" />
                </div>
                <p className="text-sm font-medium">Compras</p>
                <p className="text-[10px] text-muted-foreground">
                  Pedidos, fornecedores e lista
                </p>
              </CardContent>
            </Card>
          </Link>
          {[
            { Icon: ChefHat, label: "Produção" },
            { Icon: ShieldCheck, label: "Auditoria" },
          ].map(({ Icon, label }) => (
            <Card key={label} className="opacity-60">
              <CardContent className="flex flex-col items-start gap-2 p-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Icon className="h-4 w-4" />
                </div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-[10px] text-muted-foreground">Próxima fase</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
