import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { fetchProdutos, qk as estoqueQk, UNIDADES } from "@/lib/estoque-db";
import {
  fetchFornecedores,
  criarRequisicaoCompra,
  qk as comprasQk,
  type NovoItemCompra,
} from "@/lib/compras-db";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/compras/pedido")({
  head: () => ({ meta: [{ title: "Novo pedido — Compras" }] }),
  component: NovoPedidoPage,
});

interface LinhaItem {
  key: string;
  modo: "produto" | "custom";
  produto_id: string;
  nome_custom: string;
  quantidade: string;
  unidade: string;
  valor_unit: string;
}

function novaLinha(): LinhaItem {
  return {
    key: Math.random().toString(36).slice(2),
    modo: "produto",
    produto_id: "",
    nome_custom: "",
    quantidade: "",
    unidade: "",
    valor_unit: "",
  };
}

function NovoPedidoPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [fornecedorId, setFornecedorId] = useState<string>("");
  const [observacao, setObservacao] = useState("");
  const [linhas, setLinhas] = useState<LinhaItem[]>([novaLinha()]);

  const { data: produtos = [] } = useQuery({
    queryKey: estoqueQk.produtos,
    queryFn: fetchProdutos,
  });
  const { data: fornecedores = [] } = useQuery({
    queryKey: comprasQk.fornecedores,
    queryFn: fetchFornecedores,
  });

  const comprveis = (produtos as Array<{ id: string; nome: string; unidade: string; ativo: boolean; compravel?: boolean }>)
    .filter((p) => p.ativo && (p.compravel ?? true));
  const fornecedoresAtivos = fornecedores.filter((f) => f.ativo);

  const criar = useMutation({
    mutationFn: criarRequisicaoCompra,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: comprasQk.requisicoesCompra });
      qc.invalidateQueries({ queryKey: comprasQk.itensCompra });
      toast.success("Pedido criado");
      navigate({ to: "/compras/historico" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!user) return null;

  function updateLinha(key: string, patch: Partial<LinhaItem>) {
    setLinhas((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function removerLinha(key: string) {
    setLinhas((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.key !== key)));
  }

  function onProdutoChange(key: string, produtoId: string) {
    const p = comprveis.find((x) => x.id === produtoId);
    updateLinha(key, {
      produto_id: produtoId,
      unidade: p?.unidade ?? "",
    });
  }

  function salvar() {
    const itens: NovoItemCompra[] = [];
    for (const l of linhas) {
      const q = Number(l.quantidade);
      if (!q || q <= 0) return toast.error("Quantidade inválida em um dos itens");
      if (l.modo === "produto") {
        if (!l.produto_id) return toast.error("Selecione o produto");
        itens.push({
          produto_id: l.produto_id,
          quantidade: q,
          unidade: l.unidade || null,
          valor_unit: l.valor_unit ? Number(l.valor_unit) : null,
        });
      } else {
        if (!l.nome_custom.trim()) return toast.error("Informe o nome do item");
        itens.push({
          nome_custom: l.nome_custom.trim(),
          quantidade: q,
          unidade: l.unidade || null,
          valor_unit: l.valor_unit ? Number(l.valor_unit) : null,
        });
      }
    }
    if (itens.length === 0) return toast.error("Adicione ao menos 1 item");
    criar.mutate({
      usuario_id: user!.id,
      fornecedor_id: fornecedorId || null,
      observacao: observacao || null,
      itens,
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <Link to="/compras" className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <ArrowLeft className="h-3 w-3" /> Compras
        </Link>
        <h1 className="mt-2 font-display text-xl font-bold">Novo pedido</h1>
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Fornecedor (opcional)</label>
            <Select value={fornecedorId} onValueChange={setFornecedorId}>
              <SelectTrigger>
                <SelectValue placeholder="Sem fornecedor" />
              </SelectTrigger>
              <SelectContent>
                {fornecedoresAtivos.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Observação</label>
            <Textarea
              rows={2}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex.: urgente para o jantar de sábado"
            />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Itens
          </h2>
          <Button size="sm" variant="outline" onClick={() => setLinhas((p) => [...p, novaLinha()])}>
            <Plus className="mr-1 h-3 w-3" /> Item
          </Button>
        </div>

        {linhas.map((l, idx) => (
          <Card key={l.key}>
            <CardContent className="space-y-2 p-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Item {idx + 1}
                </p>
                {linhas.length > 1 && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive"
                    onClick={() => removerLinha(l.key)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={l.modo === "produto" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => updateLinha(l.key, { modo: "produto" })}
                >
                  Produto
                </Button>
                <Button
                  size="sm"
                  variant={l.modo === "custom" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => updateLinha(l.key, { modo: "custom" })}
                >
                  Item avulso
                </Button>
              </div>

              {l.modo === "produto" ? (
                <Select value={l.produto_id} onValueChange={(v) => onProdutoChange(l.key, v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o produto" />
                  </SelectTrigger>
                  <SelectContent>
                    {comprveis.length === 0 && (
                      <div className="px-2 py-1 text-xs text-muted-foreground">
                        Nenhum produto marcado como comprável
                      </div>
                    )}
                    {comprveis.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  placeholder="Nome do item"
                  value={l.nome_custom}
                  onChange={(e) => updateLinha(l.key, { nome_custom: e.target.value })}
                />
              )}

              <div className="grid grid-cols-3 gap-2">
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder="Qtd"
                  value={l.quantidade}
                  onChange={(e) => updateLinha(l.key, { quantidade: e.target.value })}
                />
                <Select value={l.unidade} onValueChange={(v) => updateLinha(l.key, { unidade: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Un" />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIDADES.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder="R$/un"
                  value={l.valor_unit}
                  onChange={(e) => updateLinha(l.key, { valor_unit: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button className="w-full" onClick={salvar} disabled={criar.isPending}>
        {criar.isPending ? "Salvando..." : "Enviar pedido"}
      </Button>
    </div>
  );
}
