import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useMemo, type ChangeEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { fetchProdutos, fetchSublocais, fetchLocais, qk } from "@/lib/estoque-db";
import { registrarEntrada, qk as mqk } from "@/lib/movimentos-db";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Camera, X, ArrowDownToLine } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/estoque/entrada")({
  head: () => ({ meta: [{ title: "Entrada — Estoque" }] }),
  component: EntradaPage,
});

function EntradaPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const produtosQ = useQuery({ queryKey: qk.produtos, queryFn: fetchProdutos });
  const sublocaisQ = useQuery({ queryKey: qk.sublocais, queryFn: fetchSublocais });
  const locaisQ = useQuery({ queryKey: qk.locais, queryFn: fetchLocais });

  const [produtoId, setProdutoId] = useState("");
  const [subLocalId, setSubLocalId] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | undefined>();
  const [obs, setObs] = useState("");

  const produtos = useMemo(() => (produtosQ.data ?? []).filter((p) => p.ativo), [produtosQ.data]);
  const sublocais = sublocaisQ.data ?? [];
  const locais = locaisQ.data ?? [];
  const produto = produtos.find((p) => p.id === produtoId);

  function handleProdutoChange(id: string) {
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
      if (!user) throw new Error("Sem usuário");
      await registrarEntrada({
        produto_id: produtoId,
        sublocal_destino_id: subLocalId,
        quantidade: Number(quantidade),
        observacao: obs,
        foto,
        user_id: user.id,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: mqk.saldos });
      qc.invalidateQueries({ queryKey: mqk.movimentos });
      toast.success("Entrada registrada");
      navigate({ to: "/estoque" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function salvar() {
    if (!produtoId) return toast.error("Selecione um produto");
    if (!subLocalId) return toast.error("Selecione o sub-local de destino");
    const q = Number(quantidade);
    if (!q || q <= 0) return toast.error("Quantidade inválida");
    mut.mutate();
  }

  if (!user) return null;

  return (
    <div className="space-y-4">
      <Link to="/estoque" className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <ArrowLeft className="h-3 w-3" /> Estoque
      </Link>
      <h1 className="font-display text-xl font-bold flex items-center gap-2">
        <ArrowDownToLine className="h-5 w-5 text-success" /> Registrar entrada
      </h1>

      <Card><CardContent className="space-y-3 p-4">
        <div>
          <label className="text-xs text-muted-foreground">Produto</label>
          <Select value={produtoId} onValueChange={handleProdutoChange}>
            <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
            <SelectContent>
              {produtos.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.nome} ({p.unidade})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Sub-local de destino</label>
          <Select value={subLocalId} onValueChange={setSubLocalId}>
            <SelectTrigger><SelectValue placeholder="Selecionar sub-local" /></SelectTrigger>
            <SelectContent>
              {sublocais.map((s) => {
                const l = locais.find((x) => x.id === s.local_id);
                return (
                  <SelectItem key={s.id} value={s.id}>
                    {l?.nome ? `${l.nome} · ` : ""}{s.nome}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-xs text-muted-foreground">
            Quantidade {produto && `(${produto.unidade})`}
          </label>
          <Input type="number" inputMode="decimal" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Observação (opcional)</label>
          <Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
        </div>

        <div className="flex items-start gap-2">
          <label htmlFor="foto-entrada" className="flex h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border text-sm text-muted-foreground">
            <Camera className="h-4 w-4" /> {foto ? "Trocar foto" : "Adicionar foto (opcional)"}
          </label>
          <input id="foto-entrada" type="file" accept="image/*" capture="environment" onChange={onFile} className="hidden" />
        </div>
        {fotoPreview && (
          <div className="relative">
            <img src={fotoPreview} alt="" className="max-h-40 w-full rounded-md object-cover" />
            <Button size="icon" variant="secondary" onClick={() => { setFoto(null); setFotoPreview(undefined); }} className="absolute right-2 top-2 h-7 w-7">
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        <Button className="w-full" onClick={salvar} disabled={mut.isPending}>
          {mut.isPending ? "Salvando..." : "Salvar entrada"}
        </Button>
      </CardContent></Card>
    </div>
  );
}
