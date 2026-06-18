import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  fetchRequisicoesCompra,
  fetchItensCompra,
  fetchFornecedores,
  atualizarStatusRequisicao,
  qk as comprasQk,
  type RequisicaoCompra,
  type RequisicaoCompraItem,
  type RequisicaoCompraStatus,
} from "@/lib/compras-db";
import { fetchProdutos, qk as estoqueQk } from "@/lib/estoque-db";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, XCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/compras/historico")({
  head: () => ({ meta: [{ title: "Histórico — Compras" }] }),
  component: HistoricoPage,
});

const STATUS_LABEL: Record<RequisicaoCompraStatus, string> = {
  pendente: "Pendente",
  em_compra: "Em compra",
  comprada: "Comprada",
  recebida: "Recebida",
  cancelada: "Cancelada",
};
const STATUS_COLOR: Record<RequisicaoCompraStatus, string> = {
  pendente: "bg-warning/15 text-warning",
  em_compra: "bg-primary/15 text-primary",
  comprada: "bg-success/15 text-success",
  recebida: "bg-success/15 text-success",
  cancelada: "bg-muted text-muted-foreground",
};

function HistoricoPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: reqs = [] } = useQuery({
    queryKey: comprasQk.requisicoesCompra,
    queryFn: fetchRequisicoesCompra,
  });
  const { data: itens = [] } = useQuery({
    queryKey: comprasQk.itensCompra,
    queryFn: fetchItensCompra,
  });
  const { data: fornecedores = [] } = useQuery({
    queryKey: comprasQk.fornecedores,
    queryFn: fetchFornecedores,
  });
  const { data: produtos = [] } = useQuery({
    queryKey: estoqueQk.produtos,
    queryFn: fetchProdutos,
  });

  const cancelar = useMutation({
    mutationFn: (id: string) => atualizarStatusRequisicao(id, "cancelada"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: comprasQk.requisicoesCompra });
      toast.success("Pedido cancelado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const visiveis = useMemo(() => {
    if (!user) return [] as RequisicaoCompra[];
    const isStaff = user.role === "admin" || user.role === "gerente";
    return isStaff ? reqs : reqs.filter((r) => r.usuario_id === user.id);
  }, [reqs, user]);

  if (!user) return null;
  const itensPor = new Map<string, RequisicaoCompraItem[]>();
  for (const it of itens) {
    const arr = itensPor.get(it.requisicao_id) ?? [];
    arr.push(it);
    itensPor.set(it.requisicao_id, arr);
  }
  const fornecedorNome = (id: string | null) =>
    id ? fornecedores.find((f) => f.id === id)?.nome ?? "—" : "Sem fornecedor";
  const produtoNome = (id: string | null) =>
    id ? (produtos as Array<{ id: string; nome: string }>).find((p) => p.id === id)?.nome ?? "(produto)" : "";

  return (
    <div className="space-y-4">
      <div>
        <Link to="/compras" className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <ArrowLeft className="h-3 w-3" /> Compras
        </Link>
        <h1 className="mt-2 font-display text-xl font-bold">Histórico de pedidos</h1>
      </div>

      {visiveis.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Nenhum pedido por aqui.
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {visiveis.map((r) => {
          const linhas = itensPor.get(r.id) ?? [];
          const podeCancelar = r.status === "pendente" && r.usuario_id === user.id;
          return (
            <Card key={r.id}>
              <CardContent className="space-y-2 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{fornecedorNome(r.fornecedor_id)}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(r.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLOR[r.status]}`}
                  >
                    {STATUS_LABEL[r.status]}
                  </span>
                </div>
                {r.observacao && (
                  <p className="text-xs italic text-muted-foreground">{r.observacao}</p>
                )}
                <ul className="space-y-1 rounded-md border border-border bg-muted/30 p-2">
                  {linhas.map((it) => (
                    <li key={it.id} className="flex justify-between gap-2 text-xs">
                      <span className="truncate">
                        {it.nome_custom ?? produtoNome(it.produto_id)}
                        {it.comprado && (
                          <span className="ml-1 text-[10px] text-success">✓</span>
                        )}
                      </span>
                      <span className="shrink-0 text-muted-foreground">
                        {Number(it.quantidade)} {it.unidade ?? ""}
                      </span>
                    </li>
                  ))}
                  {linhas.length === 0 && (
                    <li className="text-xs text-muted-foreground">Sem itens</li>
                  )}
                </ul>
                {podeCancelar && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-destructive"
                    onClick={() => cancelar.mutate(r.id)}
                  >
                    <XCircle className="mr-1 h-3 w-3" /> Cancelar pedido
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
