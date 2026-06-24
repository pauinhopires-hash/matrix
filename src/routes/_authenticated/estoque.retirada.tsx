import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useMemo, type ChangeEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { fetchProdutos, fetchSublocais, fetchLocais, qk } from "@/lib/estoque-db";
import { fetchSaldos, registrarRetirada, fmtQty, qk as mqk } from "@/lib/movimentos-db";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Camera, X, ArrowUpFromLine, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/estoque/retirada")({
  head: () => ({ meta: [{ title: "Retirada — Estoque" }] }),
  component: RetiradaPage,
});

function RetiradaPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const produtosQ = useQuery({ queryKey: qk.produtos, queryFn: fetchProdutos });
  const sublocaisQ = useQuery({ queryKey: qk.sublocais, queryFn: fetchSublocais });
  const locaisQ = useQuery({ queryKey: qk.locais, queryFn: fetchLocais });
  const saldosQ = useQuery({ queryKey: mqk.saldos, queryFn: fetchSaldos });

  const [produtoId, setProdutoId] = useState("");
  const [subLocalId, setSubLocalId] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | undefined>();
  const [obs, setObs] = useState("");

  const produtos = useMemo(() => (produtosQ.data ?? []).filter((p) => p.ativo), [produtosQ.data]);
  const sublocais = sublocaisQ.data ?? [];
  const locais = locaisQ.data ?? [];
  const saldos = saldosQ.data ?? [];
  const saldoTotalByProduto = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of saldos) m.set(s.produto_id, (m.get(s.produto_id) ?? 0) + Number(s.quantidade));
    return m;
  }, [saldos]);
  const produto = produtos.find((p) => p.id === produtoId);
  const saldoSublocal = Number(
    saldos.find((s) => s.produto_id === produtoId && s.sublocal_id === subLocalId)?.quantidade ?? 0,
  );

  const agrupados = useMemo(() => {
    const arr = [...produtos].sort((a, b) => {
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

  function escolherProduto(id: string) {
    setProdutoId(id);
    const p = produtos.find((x) => x.id === id);
    if (p?.default_sublocal_id) setSubLocalId(p.default_sublocal_id);
  }

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFoto(f);
    setFotoPreview(URL.createObjectURL(f));
  }

  const mut = useMutation({
    mutationFn: async () => {
      if (!user || !foto) throw new Error("Foto obrigatória");
      await registrarRetirada({
        produto_id: produtoId,
        sublocal_origem_id: subLocalId,
        quantidade: Number(quantidade),
        observacao: obs,
        foto,
        user_id: user.id,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: mqk.saldos });
      qc.invalidateQueries({ queryKey: mqk.movimentos });
      toast.success("Retirada registrada");
      navigate({ to: "/estoque" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function salvar() {
    if (!produtoId) return toast.error("Escolha um produto");
    if (!subLocalId) return toast.error("Selecione o sub-local de origem");
    const q = Number(quantidade);
    if (!q || q <= 0) return toast.error("Quantidade inválida");
    if (!foto) return toast.error("Foto é obrigatória");
    if (q > saldoSublocal && !confirm("A quantidade é maior que o saldo deste sub-local — o estoque vai ficar negativo. Confirma?")) return;
    mut.mutate();
  }

  if (!user) return null;

  return (
    <div className="space-y-4 pb-6">
      <Link to="/estoque" className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <ArrowLeft className="h-3 w-3" /> Estoque
      </Link>
      <h1 className="font-display text-xl font-bold flex items-center gap-2">
        <ArrowUpFromLine className="h-5 w-5 text-warning" /> Registrar retirada
      </h1>

      {!produtoId && (
        <div className="space-y-5">
          <p className="text-xs text-muted-foreground">Escolha o produto na lista abaixo.</p>
          {agrupados.map(({ grupo, subgrupos }) => (
            <section key={grupo}>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-primary">{grupo}</h2>
              <div className="space-y-3">
                {subgrupos.map(({ subgrupo, itens }) => (
                  <div key={subgrupo}>
                    {subgrupos.length > 1 || subgrupo !== "—" ? (
                      <p className="mb-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">{subgrupo}</p>
                    ) : null}
                    <div className="space-y-1.5">
                      {itens.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => escolherProduto(p.id)}
                          className="flex w-full items-center justify-between rounded-md border bg-card px-3 py-2.5 text-left text-sm hover:border-primary"
                        >
                          <span className="truncate font-medium">{p.nome}</span>
                          <span
                            className={`text-[10px] ${(saldoTotalByProduto.get(p.id) ?? 0) <= 0 ? "text-destructive" : "text-muted-foreground"}`}
                          >
                            {fmtQty(saldoTotalByProduto.get(p.id) ?? 0, p.unidade)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {produtoId && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Produto</p>
                <p className="text-sm font-semibold truncate">{produto?.nome}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setProdutoId("")}>
                Trocar
              </Button>
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Sub-local de origem</label>
              <Select value={subLocalId} onValueChange={setSubLocalId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar sub-local" />
                </SelectTrigger>
                <SelectContent>
                  {sublocais.map((s) => {
                    const l = locais.find((x) => x.id === s.local_id);
                    return (
                      <SelectItem key={s.id} value={s.id}>
                        {l?.nome ? `${l.nome} · ` : ""}
                        {s.nome}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {produto && subLocalId && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Saldo neste sub-local: {fmtQty(saldoSublocal, produto.unidade)}
                </p>
              )}
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Quantidade {produto && `(${produto.unidade})`}</label>
              <Input
                type="number"
                inputMode="decimal"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
              />
              {produto && Number(quantidade) > saldoSublocal && (
                <p className="mt-1 flex items-center gap-1 text-[11px] text-warning">
                  <AlertTriangle className="h-3 w-3" /> Maior que saldo atual.
                </p>
              )}
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Motivo / observação</label>
              <Textarea
                rows={2}
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                placeholder="Ex.: usado para evento X"
              />
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-1">Foto obrigatória *</p>
              <div className="flex items-start gap-2">
                <label
                  htmlFor="foto-ret"
                  className={`flex h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed text-sm ${foto ? "border-success/50 text-success" : "border-destructive/40 text-destructive"}`}
                >
                  <Camera className="h-4 w-4" /> {foto ? "Trocar foto" : "Adicionar foto"}
                </label>
                <input
                  id="foto-ret"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={onFile}
                  className="hidden"
                />
              </div>
            </div>
            {fotoPreview && (
              <div className="relative">
                <img src={fotoPreview} alt="" className="max-h-40 w-full rounded-md object-cover" />
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

            <Button className="w-full" onClick={salvar} disabled={mut.isPending || !foto || !quantidade}>
              {mut.isPending ? "Salvando..." : "Salvar retirada"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
