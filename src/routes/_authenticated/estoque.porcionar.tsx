import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useMemo, type ChangeEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { fetchProdutos, fetchSublocais, fetchLocais, qk } from "@/lib/estoque-db";
import { fetchSaldos, registrarPorcionamento, fmtQty, qk as mqk } from "@/lib/movimentos-db";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Camera, Scissors, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/estoque/porcionar")({
  head: () => ({ meta: [{ title: "Porcionar — Estoque" }] }),
  component: PorcionarPage,
});

function PorcionarPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const produtosQ = useQuery({ queryKey: qk.produtos, queryFn: fetchProdutos });
  const sublocaisQ = useQuery({ queryKey: qk.sublocais, queryFn: fetchSublocais });
  const locaisQ = useQuery({ queryKey: qk.locais, queryFn: fetchLocais });
  const saldosQ = useQuery({ queryKey: mqk.saldos, queryFn: fetchSaldos });

  const [origemId, setOrigemId] = useState("");
  const [origemSubId, setOrigemSubId] = useState("");
  const [origemQtd, setOrigemQtd] = useState("");
  const [destinoId, setDestinoId] = useState("");
  const [destinoSubId, setDestinoSubId] = useState("");
  const [destinoQtd, setDestinoQtd] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | undefined>();
  const [obs, setObs] = useState("");

  const produtos = useMemo(() => (produtosQ.data ?? []).filter((p) => p.ativo), [produtosQ.data]);
  const sublocais = sublocaisQ.data ?? [];
  const locais = locaisQ.data ?? [];
  const saldos = saldosQ.data ?? [];

  const origem = produtos.find((p) => p.id === origemId);
  const destino = produtos.find((p) => p.id === destinoId);
  const saldoOrigem = Number(
    saldos.find((s) => s.produto_id === origemId && s.sublocal_id === origemSubId)?.quantidade ?? 0,
  );

  function pickOrigem(id: string) {
    setOrigemId(id);
    const p = produtos.find((x) => x.id === id);
    if (p?.default_sublocal_id) setOrigemSubId(p.default_sublocal_id);
  }
  function pickDestino(id: string) {
    setDestinoId(id);
    const p = produtos.find((x) => x.id === id);
    if (p?.default_sublocal_id) setDestinoSubId(p.default_sublocal_id);
    else if (origemSubId) setDestinoSubId(origemSubId);
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
      await registrarPorcionamento({
        produto_origem_id: origemId,
        sublocal_origem_id: origemSubId,
        quantidade_origem: Number(origemQtd),
        produto_destino_id: destinoId,
        sublocal_destino_id: destinoSubId,
        quantidade_destino: Number(destinoQtd),
        observacao: obs,
        foto,
        user_id: user.id,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: mqk.saldos });
      qc.invalidateQueries({ queryKey: mqk.movimentos });
      toast.success(`Porcionamento concluído — ${destinoQtd}x disponível`);
      navigate({ to: "/estoque" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function salvar() {
    if (!origemId || !origemSubId) return toast.error("Selecione produto e sub-local de origem");
    if (!destinoId || !destinoSubId) return toast.error("Selecione produto e sub-local de destino");
    const oQ = Number(origemQtd);
    const dQ = Number(destinoQtd);
    if (!oQ || oQ <= 0) return toast.error("Quantidade da peça inválida");
    if (!dQ || dQ <= 0) return toast.error("Nº de porções inválido");
    if (!foto) return toast.error("Foto obrigatória");
    mut.mutate();
  }

  if (!user) return null;

  function subLabel(sid: string) {
    const s = sublocais.find((x) => x.id === sid);
    if (!s) return "";
    const l = locais.find((x) => x.id === s.local_id);
    return `${l?.nome ? l.nome + " · " : ""}${s.nome}`;
  }

  return (
    <div className="space-y-4">
      <Link to="/estoque" className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <ArrowLeft className="h-3 w-3" /> Estoque
      </Link>
      <h1 className="font-display text-xl font-bold flex items-center gap-2">
        <Scissors className="h-5 w-5 text-primary" /> Porcionar
      </h1>
      <p className="text-xs text-muted-foreground">
        Consome a matéria-prima de origem e gera porções no produto de destino.
      </p>

      <Card><CardContent className="space-y-3 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">1. Matéria-prima</p>
        <Select value={origemId} onValueChange={pickOrigem}>
          <SelectTrigger><SelectValue placeholder="Selecionar produto" /></SelectTrigger>
          <SelectContent>
            {produtos.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.nome} ({p.unidade})</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={origemSubId} onValueChange={setOrigemSubId}>
          <SelectTrigger><SelectValue placeholder="Sub-local de origem" /></SelectTrigger>
          <SelectContent>
            {sublocais.map((s) => (
              <SelectItem key={s.id} value={s.id}>{subLabel(s.id)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {origem && origemSubId && (
          <p className="text-[11px] text-muted-foreground">
            Saldo neste sub-local: {fmtQty(saldoOrigem, origem.unidade)}
          </p>
        )}
        {origem && (
          <Input type="number" inputMode="decimal" placeholder={`Qtd consumida (${origem.unidade})`}
            value={origemQtd} onChange={(e) => setOrigemQtd(e.target.value)} />
        )}
      </CardContent></Card>

      <Card><CardContent className="space-y-3 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">2. Porção destino</p>
        <Select value={destinoId} onValueChange={pickDestino}>
          <SelectTrigger><SelectValue placeholder="Selecionar produto destino" /></SelectTrigger>
          <SelectContent>
            {produtos.filter((p) => p.id !== origemId).map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.nome} ({p.unidade})</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={destinoSubId} onValueChange={setDestinoSubId}>
          <SelectTrigger><SelectValue placeholder="Sub-local de destino" /></SelectTrigger>
          <SelectContent>
            {sublocais.map((s) => (
              <SelectItem key={s.id} value={s.id}>{subLabel(s.id)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {destino && (
          <Input type="number" inputMode="decimal" placeholder={`Qtd gerada (${destino.unidade})`}
            value={destinoQtd} onChange={(e) => setDestinoQtd(e.target.value)} />
        )}
      </CardContent></Card>

      <Card><CardContent className="space-y-3 p-4">
        <Textarea rows={2} placeholder="Observação (opcional)" value={obs} onChange={(e) => setObs(e.target.value)} />
        <div>
          <p className="text-xs text-muted-foreground mb-1">Foto obrigatória *</p>
          <label htmlFor="fp" className={`flex h-12 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed text-sm ${foto ? "border-success/50 text-success" : "border-destructive/40 text-destructive"}`}>
            <Camera className="h-4 w-4" /> {foto ? "Trocar" : "Adicionar foto"}
          </label>
          <input id="fp" type="file" accept="image/*" capture="environment" onChange={onFile} className="hidden" />
          {fotoPreview && (
            <div className="relative mt-2">
              <img src={fotoPreview} alt="" className="max-h-32 w-full rounded-md object-cover" />
              <Button size="icon" variant="secondary" onClick={() => { setFoto(null); setFotoPreview(undefined); }} className="absolute right-2 top-2 h-7 w-7"><X className="h-3 w-3" /></Button>
            </div>
          )}
        </div>
        <Button className="w-full" onClick={salvar} disabled={mut.isPending || !foto}>
          {mut.isPending ? "Salvando..." : "Concluir porcionamento"}
        </Button>
      </CardContent></Card>
    </div>
  );
}
