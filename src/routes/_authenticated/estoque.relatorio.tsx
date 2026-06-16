import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { fetchProdutos, qk as estoqueQk } from "@/lib/estoque-db";
import { fmtQty } from "@/lib/movimentos-db";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, BarChart3, Download } from "lucide-react";

type MovimentoRow = Database["public"]["Tables"]["movimentos"]["Row"];

export const Route = createFileRoute("/_authenticated/estoque/relatorio")({
  head: () => ({ meta: [{ title: "Relatório — Estoque" }] }),
  component: RelatorioPage,
});

type Periodo = "7" | "30" | "90";

async function fetchMovimentosPeriodo(periodoDias: number): Promise<MovimentoRow[]> {
  const desde = new Date(Date.now() - periodoDias * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("movimentos")
    .select("*")
    .gte("created_at", desde)
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) throw new Error(error.message);
  return data ?? [];
}

function RelatorioPage() {
  const { user } = useAuth();
  const [periodo, setPeriodo] = useState<Periodo>("30");

  const { data: produtos = [] } = useQuery({
    queryKey: estoqueQk.produtos,
    queryFn: fetchProdutos,
  });
  const { data: movs = [] } = useQuery({
    queryKey: ["db", "movimentos", "periodo", periodo] as const,
    queryFn: () => fetchMovimentosPeriodo(Number(periodo)),
  });

  if (!user) return null;
  if (user.role !== "admin" && user.role !== "gerente") return <Navigate to="/estoque" />;

  const consumoArr = useMemo(() => {
    const consumo = new Map<string, number>();
    for (const m of movs) {
      const q = Number(m.quantidade);
      if (m.tipo === "retirada") {
        consumo.set(m.produto_id, (consumo.get(m.produto_id) ?? 0) + q);
      }
      if (m.tipo === "porcionamento") {
        consumo.set(m.produto_id, (consumo.get(m.produto_id) ?? 0) + q);
      }
    }
    return Array.from(consumo.entries())
      .map(([id, qtd]) => ({ produto: produtos.find((p) => p.id === id), qtd }))
      .filter((x) => x.produto)
      .sort((a, b) => b.qtd - a.qtd);
  }, [movs, produtos]);

  const porUsuarioArr = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of movs) {
      const k = m.user_id ?? "—";
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [movs]);

  function exportarCsv() {
    const linhas = [
      ["data", "tipo", "produto", "quantidade", "unidade", "user_id", "obs"],
      ...movs.map((m) => {
        const p = produtos.find((x) => x.id === m.produto_id);
        return [
          new Date(m.created_at).toISOString(),
          m.tipo,
          p?.nome ?? "",
          String(m.quantidade),
          p?.unidade ?? "",
          m.user_id ?? "",
          (m.observacao ?? "").replace(/[\n;]/g, " "),
        ];
      }),
    ];
    const csv = linhas
      .map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `estoque-${periodo}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <Link to="/estoque" className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <ArrowLeft className="h-3 w-3" /> Estoque
      </Link>
      <h1 className="font-display text-xl font-bold flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-primary" /> Relatório
      </h1>

      <div className="flex gap-2">
        <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
          <SelectTrigger className="flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={exportarCsv}>
          <Download className="mr-1 h-4 w-4" /> CSV
        </Button>
      </div>

      <Card>
        <CardContent className="space-y-2 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Consumo por produto
          </p>
          {consumoArr.length === 0 && (
            <p className="text-sm text-muted-foreground">Sem consumo no período.</p>
          )}
          {consumoArr.slice(0, 20).map(({ produto, qtd }) => (
            <div key={produto!.id} className="flex justify-between text-sm">
              <span className="truncate">{produto!.nome}</span>
              <span className="font-semibold">{fmtQty(qtd, produto!.unidade)}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Movimentos por usuário
          </p>
          {porUsuarioArr.length === 0 && (
            <p className="text-sm text-muted-foreground">Sem movimentos.</p>
          )}
          {porUsuarioArr.map(([id, n]) => (
            <div key={id} className="flex justify-between text-sm">
              <span className="font-mono text-[11px] truncate">{id.slice(0, 8)}</span>
              <span className="font-semibold">{n}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <p className="text-center text-[11px] text-muted-foreground">
        Total de movimentos: {movs.length}
      </p>
    </div>
  );
}
