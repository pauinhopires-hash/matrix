import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  fetchRequisicoesCompra,
  fetchItensCompra,
  fetchFornecedores,
  marcarItemComprado,
  qk as comprasQk,
  type RequisicaoCompraItem,
} from "@/lib/compras-db";
import { fetchProdutos, qk as estoqueQk } from "@/lib/estoque-db";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/compras/lista")({
  head: () => ({ meta: [{ title: "Lista de compras" }] }),
  component: ListaPage,
});

function ListaPage() {
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

  const marcar = useMutation({
    mutationFn: ({ id, comprado }: { id: string; comprado: boolean }) =>
      marcarItemComprado(id, comprado),
    onMutate: () => {
      // sem nada
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: comprasQk.itensCompra });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const agrupado = useMemo(() => {
    const ativos = new Set(
      reqs.filter((r) => r.status === "pendente" || r.status === "em_compra").map((r) => r.id),
    );
    const fornecedorPor = new Map(reqs.map((r) => [r.id, r.fornecedor_id] as const));
    const pendentes = itens.filter((i) => ativos.has(i.requisicao_id) && !i.comprado);
    const grupos = new Map<string, RequisicaoCompraItem[]>();
    for (const it of pendentes) {
      const fid = fornecedorPor.get(it.requisicao_id) ?? null;
      const key = fid ?? "__sem__";
      const arr = grupos.get(key) ?? [];
      arr.push(it);
      grupos.set(key, arr);
    }
    return grupos;
  }, [reqs, itens]);

  if (!user) return null;
  const isStaff = user.role === "admin" || user.role === "gerente";
  if (!isStaff) return <Navigate to="/compras" />;

  const fornecedorNome = (id: string) =>
    id === "__sem__" ? "Sem fornecedor" : fornecedores.find((f) => f.id === id)?.nome ?? "—";
  const produtoNome = (id: string | null) =>
    id ? (produtos as Array<{ id: string; nome: string }>).find((p) => p.id === id)?.nome ?? "(produto)" : "";

  const grupos = Array.from(agrupado.entries());

  return (
    <div className="space-y-4">
      <div>
        <Link to="/compras" className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <ArrowLeft className="h-3 w-3" /> Compras
        </Link>
        <h1 className="mt-2 font-display text-xl font-bold">Lista de compras</h1>
        <p className="text-xs text-muted-foreground">
          Itens pendentes em pedidos abertos, agrupados por fornecedor.
        </p>
      </div>

      {grupos.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Nada para comprar agora.
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {grupos.map(([fid, lista]) => (
          <Card key={fid}>
            <CardContent className="space-y-2 p-3">
              <p className="text-sm font-semibold">{fornecedorNome(fid)}</p>
              <ul className="space-y-1">
                {lista.map((it) => (
                  <li
                    key={it.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 p-2"
                  >
                    <label className="flex flex-1 items-center gap-2 text-xs">
                      <Checkbox
                        checked={it.comprado}
                        onCheckedChange={(v) =>
                          marcar.mutate({ id: it.id, comprado: Boolean(v) })
                        }
                      />
                      <span className="truncate">
                        {it.nome_custom ?? produtoNome(it.produto_id)}
                      </span>
                    </label>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {Number(it.quantidade)} {it.unidade ?? ""}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
