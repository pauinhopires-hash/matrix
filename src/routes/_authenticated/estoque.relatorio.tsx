import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { fetchProdutos, qk as estoqueQk } from "@/lib/estoque-db";
import { fmtQty, estornarMovimento } from "@/lib/movimentos-db";
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
import { ArrowLeft, BarChart3, Download, Undo2 } from "lucide-react";
import { toast } from "sonner";

const TIPO_MOV: Record<string, string> = {
  entrada: "Entrada",
  retirada: "Saída",
  porcionamento: "Porcionamento",
  ajuste: "Contagem/ajuste",
};

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

  const qc = useQueryClient();
  const estorno = useMutation({
    mutationFn: (m: MovimentoRow) => estornarMovimento(m as never, user!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["db", "movimentos", "periodo", periodo] });
      qc.invalidateQueries({ queryKey: ["db", "saldos"] });
      toast.success("Lançamento estornado");
    },
    onError: (e: Error) => toast.error(e.message),
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

  const desperdicioArr = useMemo(() => {
    const m = new Map<string, number>();
    for (const mv of movs) {
      const mm = mv as MovimentoRow & { motivo: string | null };
      if (mv.tipo === "retirada" && (mm.motivo === "Perda" || mm.motivo === "Quebra")) {
        m.set(mv.produto_id, (m.get(mv.produto_id) ?? 0) + Number(mv.quantidade));
      }
    }
    return Array.from(m.entries())
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
      ["data", "tipo", "produto", "quantidade", "unidade", "motivo", "user_id", "obs"],
      ...movs.map((m) => {
        const p = produtos.find((x) => x.id === m.produto_id);
        return [
          new Date(m.created_at).toISOString(),
          m.tipo,
          p?.nome ?? "",
          String(m.quantidade),
          p?.unidade ?? "",
          ((m as MovimentoRow & { motivo: string | null }).motivo ?? ""),
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

      <Card className={desperdicioArr.length ? "border-destructive/30" : undefined}>
        <CardContent className="space-y-2 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Desperdício (perdas e quebras)
          </p>
          {desperdicioArr.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem perdas/quebras no período. 🎉</p>
          ) : (
            desperdicioArr.slice(0, 20).map(({ produto, qtd }) => (
              <div key={produto!.id} className="flex justify-between text-sm">
                <span className="truncate">{produto!.nome}</span>
                <span className="font-semibold text-destructive">{fmtQty(qtd, produto!.unidade)}</span>
              </div>
            ))
          )}
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

      <Card>
        <CardContent className="space-y-2 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Movimentos recentes
          </p>
          {movs.length === 0 && (
            <p className="text-sm text-muted-foreground">Sem movimentos no período.</p>
          )}
          {movs.slice(0, 40).map((m) => {
            const mm = m as MovimentoRow & { estornado_em: string | null; estorno_de: string | null };
            const p = produtos.find((x) => x.id === m.produto_id);
            const estornavel = m.tipo !== "ajuste" && !mm.estornado_em && !mm.estorno_de;
            return (
              <div key={m.id} className="flex items-center gap-2 border-b border-border/60 py-1.5 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">
                    <span className="font-medium">{TIPO_MOV[m.tipo] ?? m.tipo}</span>
                    {" · "}
                    {p?.nome ?? "(produto removido)"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {fmtQty(Number(m.quantidade), p?.unidade ?? "")} ·{" "}
                    {new Date(m.created_at).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {mm.estornado_em ? " · estornado" : ""}
                    {mm.estorno_de ? " · (estorno)" : ""}
                  </p>
                </div>
                {estornavel && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 shrink-0 text-[11px]"
                    disabled={estorno.isPending}
                    onClick={() => {
                      if (confirm(`Estornar este lançamento de ${p?.nome ?? "produto"}? O estoque será corrigido.`)) {
                        estorno.mutate(m);
                      }
                    }}
                  >
                    <Undo2 className="mr-1 h-3 w-3" /> Estornar
                  </Button>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <p className="text-center text-[11px] text-muted-foreground">
        Total de movimentos: {movs.length}
      </p>
    </div>
  );
}
