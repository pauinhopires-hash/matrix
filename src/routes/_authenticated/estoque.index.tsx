import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  fetchProdutos,
  fetchSublocais,
  fetchLocais,
  LIDER_LABEL,
  qk as estoqueQk,
} from "@/lib/estoque-db";
import { fetchSaldos, qk as movQk, fmtQty } from "@/lib/movimentos-db";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import {
  Package,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Scissors,
  ClipboardList,
  ClipboardCheck,
  BarChart3,
  Boxes,
  MapPin,
  Tags,
  Upload,
  CalendarClock,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/estoque/")({
  head: () => ({ meta: [{ title: "Estoque — Misturaria Control" }] }),
  component: EstoquePage,
});

function EstoquePage() {
  const { user } = useAuth();
  const { data: produtos = [] } = useQuery({
    queryKey: estoqueQk.produtos,
    queryFn: fetchProdutos,
  });
  const { data: sublocais = [] } = useQuery({
    queryKey: estoqueQk.sublocais,
    queryFn: fetchSublocais,
  });
  const { data: locais = [] } = useQuery({
    queryKey: estoqueQk.locais,
    queryFn: fetchLocais,
  });
  const { data: saldos = [] } = useQuery({
    queryKey: movQk.saldos,
    queryFn: fetchSaldos,
  });
  const { data: vencendo = 0 } = useQuery({
    queryKey: ["db", "validades_vencendo"],
    queryFn: async () => {
      const lim = new Date();
      lim.setDate(lim.getDate() + 3);
      const limStr = lim.toISOString().slice(0, 10);
      const { count, error } = await (supabase as unknown as { from: (t: string) => any })
        .from("validades")
        .select("id", { count: "exact", head: true })
        .is("baixado_em", null)
        .lte("validade", limStr);
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
  });

  const saldoTotalByProduto = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of saldos) {
      m.set(s.produto_id, (m.get(s.produto_id) ?? 0) + Number(s.quantidade));
    }
    return m;
  }, [saldos]);

  const alertas = useMemo(
    () =>
      produtos.filter(
        (p) =>
          p.ativo && (saldoTotalByProduto.get(p.id) ?? 0) < Number(p.estoque_minimo),
      ),
    [produtos, saldoTotalByProduto],
  );

  if (!user) return null;
  const isStaff = user.role === "admin" || user.role === "gerente";

  const atalhos = [
    { to: "/estoque/entrada", label: "Entrada", Icon: ArrowDownToLine, color: "bg-success/15 text-success" },
    { to: "/estoque/retirada", label: "Retirada", Icon: ArrowUpFromLine, color: "bg-warning/15 text-warning" },
    { to: "/estoque/porcionar", label: "Porcionar", Icon: Scissors, color: "bg-primary/15 text-primary" },
    { to: "/estoque/requisicoes", label: "Requisições", Icon: ClipboardList, color: "bg-accent/40 text-accent-foreground" },
    { to: "/estoque/validades", label: "Validade", Icon: CalendarClock, color: "bg-amber-500/15 text-amber-600" },
    ...(isStaff
      ? [{ to: "/estoque/contagem", label: "Contagem", Icon: ClipboardCheck, color: "bg-primary/15 text-primary" }]
      : []),
    { to: "/estoque/produtos", label: "Produtos", Icon: Boxes, color: "bg-muted text-foreground" },
    { to: "/estoque/locais", label: "Locais", Icon: MapPin, color: "bg-muted text-foreground" },
    { to: "/estoque/categorias", label: "Categorias", Icon: Tags, color: "bg-muted text-foreground" },
    ...(isStaff
      ? [
          { to: "/estoque/importar", label: "Importar", Icon: Upload, color: "bg-muted text-foreground" },
          { to: "/estoque/relatorio", label: "Relatório", Icon: BarChart3, color: "bg-muted text-foreground" },
        ]
      : []),
  ] as const;

  const resumoLocais = locais.map((l) => {
    const subs = sublocais.filter((s) => s.local_id === l.id);
    const subIds = new Set(subs.map((s) => s.id));
    const prods = produtos.filter(
      (p) => p.default_sublocal_id && subIds.has(p.default_sublocal_id),
    );
    const alert = prods.filter(
      (p) => (saldoTotalByProduto.get(p.id) ?? 0) < Number(p.estoque_minimo),
    ).length;
    return { local: l, subs, total: prods.length, alert };
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <Package className="h-6 w-6 text-primary" /> Estoque
        </h1>
        <p className="text-xs text-muted-foreground">
          Controle por Local, Sub-local e Líder responsável.
        </p>
      </div>

      {alertas.length > 0 && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <p className="text-sm font-semibold">
                {alertas.length} item(ns) abaixo do mínimo
              </p>
            </div>
            <ul className="text-xs text-muted-foreground space-y-0.5">
              {alertas.slice(0, 5).map((p) => (
                <li key={p.id}>
                  • {p.nome} —{" "}
                  {fmtQty(saldoTotalByProduto.get(p.id) ?? 0, p.unidade)} (mín{" "}
                  {fmtQty(Number(p.estoque_minimo), p.unidade)})
                </li>
              ))}
              {alertas.length > 5 && <li>+ {alertas.length - 5} outros</li>}
            </ul>
          </CardContent>
        </Card>
      )}

      {vencendo > 0 && (
        <Link to="/estoque/validades" className="block">
          <Card className="border-amber-500/40 bg-amber-500/5">
            <CardContent className="flex items-center gap-3 p-3">
              <CalendarClock className="h-5 w-5 shrink-0 text-amber-600" />
              <p className="flex-1 text-sm font-semibold text-amber-700">
                {vencendo} item(ns) vencendo ou vencidos
              </p>
            </CardContent>
          </Card>
        </Link>
      )}

      <div className="grid grid-cols-3 gap-2">
        {atalhos.map(({ to, label, Icon, color }) => (
          <Link key={to} to={to} className="block">
            <Card className="transition active:scale-[0.97]">
              <CardContent className="flex flex-col items-center gap-1 p-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <p className="text-[11px] font-medium text-center leading-tight">{label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Locais
        </h2>
        {resumoLocais.length === 0 && (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              Nenhum local cadastrado.
            </CardContent>
          </Card>
        )}
        {resumoLocais.map(({ local, subs, total, alert }) => (
          <Card key={local.id}>
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">{local.nome}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {local.responsavel ? LIDER_LABEL[local.responsavel] : "—"} · {total} produto(s)
                  </p>
                </div>
                {alert > 0 && (
                  <span className="text-[10px] font-semibold text-destructive">
                    {alert} alerta(s)
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                {subs.map((s) => (
                  <span
                    key={s.id}
                    className="text-[10px] rounded bg-muted px-1.5 py-0.5"
                  >
                    {s.nome}
                  </span>
                ))}
                {subs.length === 0 && (
                  <span className="text-[10px] text-muted-foreground">Sem sub-locais</span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
