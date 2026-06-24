import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo, type ChangeEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
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
import { ArrowLeft, Camera, X, Plus, Check, XCircle, PackageCheck, Send } from "lucide-react";
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

  const agrupados = useMemo(() => {
    const arr = produtos
      .filter((p) => p.ativo)
      .sort((a, b) => {
        const ga = (a.grupo ?? "Outros").localeCompare(b.grupo ?? "Outros");
        if (ga !== 0) return ga;
        const sa = (a.subgrupo ?? "—").localeCompare(b.subgrupo ?? "—");
        if (sa !== 0) return sa;
        return a.nome.localeCompare(b.nome);
      });
    const map = new Map<string, Map<string, typeof arr>>();
    for (const p of arr) {
      const g = p.grupo ?? "Outros";
      const sg = p.subgrupo ?? "—";
      if (!map.has(g)) map.set(g, new Map());
      const sub = map.get(g)!;
      if (!sub.has(sg)) sub.set(sg, []);
      sub.get(sg)!.push(p);
    }
    return Array.from(map.entries()).map(([grupo, subs]) => ({
      grupo,
      subgrupos: Array.from(subs.entries()).map(([subgrupo, itens]) => ({ subgrupo, itens })),
    }));
  }, [produtos]);

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
  const produto = produtos.find((p) => p.id === produtoId);
  const podeDecidir = user.role === "admin" || user.role === "gerente";

  function enviarWhatsapp() {
    const linhas: string[] = [`📋 Requisições — ${new Date().toLocaleDateString("pt-BR")}`, ""];
    for (const r of reqs as Requisicao[]) {
      const p2 = produtos.find((x) => x.id === r.produto_id);
      linhas.push(`• ${p2?.nome ?? "(produto)"}: ${Number(r.quantidade)} ${p2?.unidade ?? ""} — ${STATUS_LABEL[r.status]}`);
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(linhas.join("\n"))}`, "_blank");
  }

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFoto(f);
    const reader = new FileReader();
    reader.onload = () => setFotoPreview(reader.result as string);
    reader.readAsDataURL(f);
  }

  function salvar() {
    if (!produtoId) return toast.error("Escolha um produto");
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
          <Button size="sm" onClick={() => { setNovo(!novo); setProdutoId(""); }}>
            <Plus className="mr-1 h-4 w-4" /> Nova
          </Button>
        </div>
      </div>

      {reqs.length > 0 && (
        <Button variant="outline" size="sm" className="w-full" onClick={enviarWhatsapp}>
          <Send className="mr-2 h-4 w-4" /> Enviar lista no WhatsApp
        </Button>
      )}

      {novo && (
        <Card>
          <CardContent className="space-y-3 p-4">
            {!produtoId ? (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">Escolha o produto na lista:</p>
                {agrupados.map(({ grupo, subgrupos }) => (
                  <section key={grupo}>
                    <h2 className="mb-1.5 text-xs font-bold uppercase tracking-widest text-primary">{grupo}</h2>
                    <div className="space-y-2.5">
                      {subgrupos.map(({ subgrupo, itens }) => (
                        <div key={subgrupo}>
                          {subgrupos.length > 1 || subgrupo !== "—" ? (
                            <p className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">{subgrupo}</p>
                          ) : null}
                          <div className="space-y-1.5">
                            {itens.map((p) => (
                              <button
                                key={p.id}
                                onClick={() => setProdutoId(p.id)}
                                className="flex w-full items-center justify-between rounded-md border bg-card px-3 py-2.5 text-left text-sm hover:border-primary"
                              >
                                <span className="truncate font-medium">{p.nome}</span>
                                <span className="text-[10px] text-muted-foreground">{p.unidade}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Produto</p>
                    <p className="text-sm font-semibold truncate">{produto?.nome}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setProdutoId("")}>Trocar</Button>
                </div>
                <Input
                  type="number"
                  placeholder={`Quantidade${produto ? ` (${produto.unidade})` : ""}`}
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
                      onClick={() => { setFoto(null); setFotoPreview(undefined); }}
                      className="absolute right-2 top-2 h-7 w-7"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                <Button className="w-full" onClick={salvar} disabled={criar.isPending}>
                  {criar.isPending ? "Enviando..." : "Enviar requisição"}
                </Button>
              </>
            )}
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
                {r.foto_url && <ReqFoto value={r.foto_url} />}
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

// Extrai o caminho do arquivo a partir de uma URL pública antiga ou de um caminho cru
function extrairPath(v: string): string {
  const marker = "/estoque-fotos/";
  const i = v.indexOf(marker);
  if (i >= 0) return v.slice(i + marker.length).split("?")[0];
  return v.replace(/^\/+/, "");
}

// Exibe a foto da requisição via link assinado (bucket privado)
function ReqFoto({ value }: { value: string }) {
  const { data: url } = useQuery({
    queryKey: ["req-foto", value],
    queryFn: async () => {
      const path = extrairPath(value);
      const { data, error } = await supabase.storage
        .from("estoque-fotos")
        .createSignedUrl(path, 60 * 60);
      if (error) throw new Error(error.message);
      return data.signedUrl;
    },
    staleTime: 1000 * 60 * 30,
  });
  if (!url) return null;
  return <img src={url} alt="" className="max-h-24 rounded object-cover" />;
}
