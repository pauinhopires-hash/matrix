import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { fetchProdutos, fetchSublocais, fetchLocais, qk } from "@/lib/estoque-db";
import { fetchSaldos, registrarAjusteBulk, qk as mqk, fmtQty } from "@/lib/movimentos-db";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ClipboardCheck, Save, ListChecks } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/estoque/contagem")({
  head: () => ({ meta: [{ title: "Contagem inicial — Estoque" }] }),
  component: ContagemPage,
});

function ContagemPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const produtosQ = useQuery({ queryKey: qk.produtos, queryFn: fetchProdutos });
  const sublocaisQ = useQuery({ queryKey: qk.sublocais, queryFn: fetchSublocais });
  const locaisQ = useQuery({ queryKey: qk.locais, queryFn: fetchLocais });
  const saldosQ = useQuery({ queryKey: mqk.saldos, queryFn: fetchSaldos });

  const [sublocalId, setSublocalId] = useState("");
  const [busca, setBusca] = useState("");
  const [qtds, setQtds] = useState<Record<string, string>>({});
  const inputsRef = useRef<Record<string, HTMLInputElement | null>>({});

  const sublocais = sublocaisQ.data ?? [];
  const locais = locaisQ.data ?? [];

  const produtosDoSublocal = useMemo(
    () => (produtosQ.data ?? []).filter((p) => p.ativo && p.default_sublocal_id === sublocalId),
    [produtosQ.data, sublocalId],
  );

  // Contagem por sub-local (saldos já lançados)
  const sublocaisComStatus = useMemo(() => {
    const saldoSet = new Set((saldosQ.data ?? []).filter((s) => Number(s.quantidade) !== 0).map((s) => s.sublocal_id));
    return sublocais.map((s) => {
      const total = (produtosQ.data ?? []).filter((p) => p.ativo && p.default_sublocal_id === s.id).length;
      const local = locais.find((l) => l.id === s.local_id);
      return { ...s, total, jaContado: saldoSet.has(s.id), localNome: local?.nome ?? "" };
    });
  }, [sublocais, produtosQ.data, saldosQ.data, locais]);

  const saldoMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of saldosQ.data ?? []) m.set(`${s.produto_id}:${s.sublocal_id}`, Number(s.quantidade));
    return m;
  }, [saldosQ.data]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return produtosDoSublocal;
    return produtosDoSublocal.filter((p) => p.nome.toLowerCase().includes(q));
  }, [produtosDoSublocal, busca]);

  const preenchidos = Object.entries(qtds).filter(([, v]) => v.trim() !== "" && !isNaN(Number(v)));
  const total = produtosDoSublocal.length;
  const progresso = total > 0 ? Math.round((preenchidos.length / total) * 100) : 0;

  const focusNext = useCallback(
    (currentId: string) => {
      const idx = filtrados.findIndex((p) => p.id === currentId);
      const next = filtrados[idx + 1];
      if (next) inputsRef.current[next.id]?.focus();
    },
    [filtrados],
  );

  const marcarRestantesZero = () => {
    setQtds((cur) => {
      const next = { ...cur };
      for (const p of produtosDoSublocal) {
        if (next[p.id] === undefined || next[p.id].trim() === "") next[p.id] = "0";
      }
      return next;
    });
  };

  const mut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sem usuário");
      const items = preenchidos.map(([produto_id, v]) => ({
        produto_id,
        sublocal_id: sublocalId,
        quantidade: Number(v),
      }));
      return registrarAjusteBulk(items, user.id, "Contagem inicial");
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: mqk.saldos });
      qc.invalidateQueries({ queryKey: mqk.movimentos });
      toast.success(`${n} produto(s) salvos. Escolha o próximo sub-local.`);
      setQtds({});
      setBusca("");
      setSublocalId("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!user) return null;
  const podeEditar = user.role === "admin" || user.role === "gerente";

  return (
    <div className="space-y-4 pb-24">
      <Link to="/estoque" className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <ArrowLeft className="h-3 w-3" /> Estoque
      </Link>
      <div>
        <h1 className="font-display text-xl font-bold flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-primary" /> Contagem inicial
        </h1>
        <p className="text-xs text-muted-foreground">
          Conte uma estante por vez. Use Enter pra ir pro próximo produto. "Marcar restantes como 0" preenche o resto.
        </p>
      </div>

      {!podeEditar && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            Apenas admin ou gerente pode registrar contagem.
          </CardContent>
        </Card>
      )}

      {!sublocalId && (
        <Card>
          <CardContent className="space-y-2 p-3">
            <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              <ListChecks className="h-3 w-3" /> Escolha um sub-local
            </p>
            <div className="grid grid-cols-1 gap-1.5">
              {sublocaisComStatus.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSublocalId(s.id)}
                  className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-left text-sm hover:bg-accent"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {s.localNome} · {s.nome}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{s.total} produto(s)</p>
                  </div>
                  {s.jaContado ? (
                    <span className="text-[10px] rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-600">
                      contado
                    </span>
                  ) : (
                    <span className="text-[10px] rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-600">
                      pendente
                    </span>
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {sublocalId && (
        <>
          <Card>
            <CardContent className="space-y-2 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Contando</p>
                  <p className="text-sm font-semibold truncate">
                    {(() => {
                      const s = sublocais.find((x) => x.id === sublocalId);
                      const l = locais.find((x) => x.id === s?.local_id);
                      return `${l?.nome ?? ""} · ${s?.nome ?? ""}`;
                    })()}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setSublocalId(""); setQtds({}); setBusca(""); }}>
                  Trocar
                </Button>
              </div>
              <Progress value={progresso} className="h-1.5" />
              <p className="text-[10px] text-muted-foreground">
                {preenchidos.length} de {total} preenchido(s) ({progresso}%)
              </p>
              <Input placeholder="Buscar produto..." value={busca} onChange={(e) => setBusca(e.target.value)} />
              <Button variant="outline" size="sm" className="w-full" onClick={marcarRestantesZero} disabled={!podeEditar}>
                Marcar restantes como 0
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-1.5">
            {filtrados.map((p) => {
              const saldoAtual = saldoMap.get(`${p.id}:${sublocalId}`) ?? 0;
              return (
                <Card key={p.id}>
                  <CardContent className="flex items-center gap-2 p-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{p.nome}</p>
                      <p className="text-[10px] text-muted-foreground">
                        atual: {fmtQty(saldoAtual, p.unidade)} · mín {fmtQty(Number(p.estoque_minimo), p.unidade)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Input
                        ref={(el) => { inputsRef.current[p.id] = el; }}
                        type="number"
                        inputMode="decimal"
                        step="any"
                        className="h-9 w-20 text-right"
                        placeholder="0"
                        value={qtds[p.id] ?? ""}
                        onChange={(e) => setQtds((s) => ({ ...s, [p.id]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            focusNext(p.id);
                          }
                        }}
                        disabled={!podeEditar}
                      />
                      <span className="text-[10px] w-8 text-muted-foreground">{p.unidade}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {filtrados.length === 0 && (
              <Card>
                <CardContent className="p-6 text-center text-sm text-muted-foreground">
                  Nenhum produto neste sub-local.
                </CardContent>
              </Card>
            )}
          </div>

          {podeEditar && (
            <div className="fixed bottom-16 left-0 right-0 z-20 px-4">
              <Button
                className="w-full shadow-lg"
                size="lg"
                onClick={() => mut.mutate()}
                disabled={mut.isPending || preenchidos.length === 0}
              >
                <Save className="mr-2 h-4 w-4" />
                {mut.isPending ? "Salvando..." : `Salvar contagem (${preenchidos.length})`}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
