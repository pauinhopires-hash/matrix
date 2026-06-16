import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type ChangeEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { fetchProdutos, qk as estoqueQk } from "@/lib/estoque-db";
import {
  fetchRequisicoes,
  criarRequisicao,
  decidirRequisicao,
  qk as reqQk,
  type Requisicao,
  type RequisicaoStatus,
} from "@/lib/requisicoes-db";
import { fmtQty } from "@/lib/movimentos-db";
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
import { ArrowLeft, Camera, X, Plus, Check, XCircle, PackageCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/estoque/requisicoes")({
  head: () => ({ meta: [{ title: "Requisições — Estoque" }] }),
  component: RequisicoesPage,
});

const STATUS_LABEL: Record<RequisicaoStatus, string> = {
  pendente: "Pendente",
  atendida: "Atendida",
  recusada: "Recusada",
  cancelada: "Cancelada",
};
const STATUS_COLOR: Record<RequisicaoStatus, string> = {
  pendente: "bg-warning/15 text-warning",
  atendida: "bg-success/15 text-success",
  recusada: "bg-destructive/15 text-destructive",
  cancelada: "bg-muted text-muted-foreground",
};

function RequisicoesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [novo, setNovo] = useState(false);
  const [produtoId, setProdutoId] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [motivo, setMotivo] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | undefined>();

  const { data: produtos = [] } = useQuery({
    queryKey: estoqueQk.produtos,
    queryFn: fetchProdutos,
  });
  const { data: reqs = [] } = useQuery({
    queryKey: reqQk.requisicoes,
    queryFn: fetchRequisicoes,
  });

  const criar = useMutation({
    mutationFn: criarRequisicao,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reqQk.requisicoes });
      toast.success("Requisição criada");
      setNovo(false);
      setProdutoId("");
      setQuantidade("");
      setMotivo("");
      setFoto(null);
      setFotoPreview(undefined);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const decidir = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Exclude<RequisicaoStatus, "pendente"> }) =>
      decidirRequisicao(id, status, user!.id),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: reqQk.requisicoes });
      toast.success(`Requisição ${STATUS_LABEL[vars.status].toLowerCase()}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!user) return null;
  const produtosAtivos = produtos.filter((p) => p.ativo);
  const podeDecidir = user.role === "admin" || user.role === "gerente";

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFoto(f);
    const reader = new FileReader();
    reader.onload = () => setFotoPreview(reader.result as string);
    reader.readAsDataURL(f);
  }

  function salvar() {
    if (!produtoId) return toast.error("Selecione produto");
    const q = Number(quantidade);
    if (!q || q <= 0) return toast.error("Quantidade inválida");
    criar.mutate({
      produto_id: produtoId,
      quantidade: q,
      observacao: motivo || undefined,
      foto,
      user_id: user!.id,
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <Link to="/estoque" className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <ArrowLeft className="h-3 w-3" /> Estoque
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <h1 className="font-display text-xl font-bold">Requisições</h1>
          <Button size="sm" onClick={() => setNovo(!novo)}>
            <Plus className="mr-1 h-4 w-4" /> Nova
          </Button>
        </div>
      </div>

      {novo && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <Select value={produtoId} onValueChange={setProdutoId}>
              <SelectTrigger>
                <SelectValue placeholder="Produto" />
              </SelectTrigger>
              <SelectContent>
                {produtosAtivos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              placeholder="Quantidade"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
            />
            <Textarea
              rows={2}
              placeholder="Motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
            <label
              htmlFor="freq"
              className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border text-xs text-muted-foreground"
            >
              <Camera className="h-3 w-3" /> {foto ? "Trocar foto" : "Foto (opcional)"}
            </label>
            <input
              id="freq"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={onFile}
              className="hidden"
            />
            {fotoPreview && (
              <div className="relative">
                <img src={fotoPreview} alt="" className="max-h-32 w-full rounded-md object-cover" />
                <Button
                  size="icon"
                  variant="secondary"
                  onClick={() => {
                    setFoto(null);
                    setFotoPreview(undefined);
                  }}
                  className="absolute right-2 top-2 h-7 w-7"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
            <Button className="w-full" onClick={salvar} disabled={criar.isPending}>
              {criar.isPending ? "Enviando..." : "Enviar requisição"}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {reqs.length === 0 && (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              Nenhuma requisição.
            </CardContent>
          </Card>
        )}
        {reqs.map((r: Requisicao) => {
          const p = produtos.find((x) => x.id === r.produto_id);
          return (
            <Card key={r.id}>
              <CardContent className="space-y-2 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{p?.nome ?? "(produto removido)"}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {p ? fmtQty(Number(r.quantidade), p.unidade) : r.quantidade}
                    </p>
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
                {r.foto_url && (
                  <img src={r.foto_url} alt="" className="max-h-24 rounded object-cover" />
                )}
                {podeDecidir && r.status === "pendente" && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => decidir.mutate({ id: r.id, status: "atendida" })}
                    >
                      <PackageCheck className="mr-1 h-3 w-3" /> Atender
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-destructive"
                      onClick={() => decidir.mutate({ id: r.id, status: "recusada" })}
                    >
                      <XCircle className="mr-1 h-3 w-3" /> Recusar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => decidir.mutate({ id: r.id, status: "cancelada" })}
                    >
                      <Check className="mr-1 h-3 w-3" /> Cancelar
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
