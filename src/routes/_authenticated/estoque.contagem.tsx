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

  // TODOS os produtos ativos (não filtra por default_sublocal) — conta a lista completa
  const produtosAtivos = useMemo(() => (produtosQ.data ?? []).filter((p) => p.ativo), [produtosQ.data]);

  const sublocaisComStatus = useMemo(() => {
    const saldoSet = new Set((saldosQ.data ?? []).filter((s) => Number(s.quantidade) !== 0).map((s) => s.sublocal_id));
    return sublocais.map((s) => {
      const local = locais.find((l) => l.id === s.local_id);
      return { ...s, jaContado: saldoSet.has(s.id), localNome: local?.nome ?? "" };
    });
  }, [sublocais, saldosQ.data, locais]);

  const saldoMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of saldosQ.data ?? []) m.set(`${s.produto_id}:${s.sublocal_id}`, Number(s.quantidade));
    return m;
  }, [saldosQ.data]);

  // lista filtrada e ordenada por grupo > subgrupo > nome (para visualizar)
  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const arr = produtosAtivos.filter((p) => !q || p.nome.toLowerCase().includes(q));
    return [...arr].sort((a, b) => {
      const ga = (a.grupo ?? "Outros").localeCompare(b.grupo ?? "Outros");
      if (ga !== 0) return ga;
      const sa = (a.subgrupo ?? "—").localeCompare(b.subgrupo ?? "—");
      if (sa !== 0) return sa;
      return a.nome.localeCompare(b.nome);
    });
  }, [produtosAtivos, busca]);

  // agrupa para render
  const agrupados = useMemo(() => {
    const map = new Map<string, Map<string, typeof filtrados>>();
    for (const p of filtrados) {
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
  }, [filtrados]);

  const preenchidos = Object.entries(qtds).filter(([, v]) => v.trim() !== "" && !isNaN(Number(v)));
  const total = produtosAtivos.length;
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
      for (const p of produtosAtivos) {
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
      toast.success(`${n} produto(s) salvos.`);
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
    <div className="space-y-4 pb-28">
      <Link to="/estoque" className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <ArrowLeft className="h-3 w-3" /> Estoque
      </Link>
      <div>
        <h1 className="font-display text-xl font-bold flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-primary" /> Contagem de estoque
        </h1>
        <p className="text-xs text-muted-foreground">
          Escolha o local e veja a lista completa de produtos. Digite a quantidade de cada um.
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
              <ListChecks className="h-3 w-3" /> Escolha o local para contar
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
                    <p className="text-[10px] text-muted-foreground">{produtosAtivos.length} produto(s)</p>
                  </div>
                  {s.jaContado ? (
                    <span className="text-[10px] rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-600">
                      tem estoque
                    </span>
                  ) : (
                    <span className="text-[10px] rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-600">vazio</span>
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
                  <p className="text-xs text-muted-foreground">Contando em</p>
                  <p className="text-sm font-semibold truncate">
                    {(() => {
                      const s = sublocais.find((x) => x.id === sublocalId);
                      const l = locais.find((x) => x.id === s?.local_id);
                      return `${l?.nome ?? ""} · ${s?.nome ?? ""}`;
                    })()}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSublocalId("");
                    setQtds({});
                    setBusca("");
                  }}
                >
                  Trocar
                </Button>
              </div>
              <Progress value={progresso} className="h-1.5" />
              <p className="text-[10px] text-muted-foreground">
                {preenchidos.length} de {total} preenchido(s) ({progresso}%)
              </p>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={marcarRestantesZero}
                disabled={!podeEditar}
              >
                Marcar restantes como 0
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-5">
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
                        {itens.map((p) => {
                          const saldoAtual = saldoMap.get(`${p.id}:${sublocalId}`) ?? 0;
                          return (
                            <Card key={p.id}>
                              <CardContent className="flex items-center gap-2 p-2.5">
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium truncate">{p.nome}</p>
                                  <p className="text-[10px] text-muted-foreground">
                                    atual: {fmtQty(saldoAtual, p.unidade)}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Input
                                    ref={(el) => {
                                      inputsRef.current[p.id] = el;
                                    }}
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
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
            {filtrados.length === 0 && (
              <Card>
                <CardContent className="p-6 text-center text-sm text-muted-foreground">
                  Nenhum produto encontrado.
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
