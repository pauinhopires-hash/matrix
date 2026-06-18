import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  fetchRequisicoesCompra,
  fetchItensCompra,
  fetchFornecedores,
  atualizarStatusRequisicao,
  qk as comprasQk,
  type RequisicaoCompraItem,
  type RequisicaoCompraStatus,
} from "@/lib/compras-db";
import { fetchProdutos, qk as estoqueQk } from "@/lib/estoque-db";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/requisicoes-compra")({
  head: () => ({ meta: [{ title: "Aprovar pedidos — Compras" }] }),
  component: AdminRequisicoesComprasPage,
});

const STATUS: RequisicaoCompraStatus[] = [
  "pendente",
  "em_compra",
  "comprada",
  "recebida",
  "cancelada",
];
const STATUS_LABEL: Record<RequisicaoCompraStatus, string> = {
  pendente: "Pendente",
  em_compra: "Em compra",
  comprada: "Comprada",
  recebida: "Recebida",
  cancelada: "Cancelada",
};

function AdminRequisicoesComprasPage() {
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

  const mudar = useMutation({
    mutationFn: ({ id, status }: { id: string; status: RequisicaoCompraStatus }) =>
      atualizarStatusRequisicao(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: comprasQk.requisicoesCompra });
      toast.success("Status atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!user) return null;
  const isStaff = user.role === "admin" || user.role === "gerente";
  if (!isStaff) return <Navigate to="/compras" />;

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
        <h1 className="mt-2 font-display text-xl font-bold">Aprovar pedidos</h1>
      </div>

      {reqs.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Sem pedidos no momento.
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {reqs.map((r) => {
          const linhas = itensPor.get(r.id) ?? [];
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
                  <Select
                    value={r.status}
                    onValueChange={(v) =>
                      mudar.mutate({ id: r.id, status: v as RequisicaoCompraStatus })
                    }
                  >
                    <SelectTrigger className="h-8 w-[140px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {r.observacao && (
                  <p className="text-xs italic text-muted-foreground">{r.observacao}</p>
                )}
                <ul className="space-y-1 rounded-md border border-border bg-muted/30 p-2">
                  {linhas.map((it) => (
                    <li key={it.id} className="flex justify-between gap-2 text-xs">
                      <span className="truncate">
                        {it.nome_custom ?? produtoNome(it.produto_id)}
                        {it.comprado && <span className="ml-1 text-[10px] text-success">✓</span>}
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
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
