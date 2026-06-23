import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { fetchProdutos, fetchSublocais, fetchLocais, qk } from "@/lib/estoque-db";
import { fetchSaldos, qk as mqk, fmtQty } from "@/lib/movimentos-db";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ClipboardCheck, ListChecks, FileText, Copy, Send, Trash2, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/estoque/contagem")({
  head: () => ({ meta: [{ title: "Contagem (rascunho) — Estoque" }] }),
  component: ContagemPage,
});

function hojeBR() {
  return new Date().toLocaleDateString("pt-BR");
}

function ContagemPage() {
  const { user } = useAuth();

  const produtosQ = useQuery({ queryKey: qk.produtos, queryFn: fetchProdutos });
  const sublocaisQ = useQuery({ queryKey: qk.sublocais, queryFn: fetchSublocais });
  const locaisQ = useQuery({ queryKey: qk.locais, queryFn: fetchLocais });
  const saldosQ = useQuery({ queryKey: mqk.saldos, queryFn: fetchSaldos });

  const [sublocalId, setSublocalId] = useState("");
  const [qtds, setQtds] = useState<Record<string, string>>({});
  const [relatorio, setRelatorio] = useState<string | null>(null);
  const inputsRef = useRef<Record<string, HTMLInputElement | null>>({});

  const sublocais = sublocaisQ.data ?? [];
  const locais = locaisQ.data ?? [];
  const produtosAtivos = useMemo(() => (produtosQ.data ?? []).filter((p) => p.ativo), [produtosQ.data]);

  const localNomeById = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of sublocais) {
      const l = locais.find((x) => x.id === s.local_id);
      m.set(s.id, `${l?.nome ?? ""} · ${s.nome}`);
    }
    return m;
  }, [sublocais, locais]);

  // Produtos cujo LOCAL PADRÃO é o sub-local escolhido (cada item no seu lugar)
  const produtosDoLocal = useMemo(
    () => produtosAtivos.filter((p) => p.default_sublocal_id === sublocalId),
    [produtosAtivos, sublocalId],
  );

  const saldoMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of saldosQ.data ?? []) m.set(`${s.produto_id}:${s.sublocal_id}`, Number(s.quantidade));
    return m;
  }, [saldosQ.data]);

  const isFilled = useCallback(
    (id: string) => {
      const v = qtds[id];
      return v !== undefined && v.trim() !== "" && !isNaN(Number(v));
    },
    [qtds],
  );

  const sublocaisComStatus = useMemo(() => {
    return sublocais
      .map((s) => {
        const doLocal = produtosAtivos.filter((p) => p.default_sublocal_id === s.id);
        const contados = doLocal.filter((p) => isFilled(p.id)).length;
        return {
          ...s,
          total: doLocal.length,
          contados,
          localNome: localNomeById.get(s.id) ?? s.nome,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [sublocais, produtosAtivos, isFilled, localNomeById]);

  const ordenados = useMemo(() => {
    return [...produtosDoLocal].sort((a, b) => {
      const ga = (a.grupo ?? "Outros").localeCompare(b.grupo ?? "Outros");
      if (ga !== 0) return ga;
      const sa = (a.subgrupo ?? "—").localeCompare(b.subgrupo ?? "—");
      if (sa !== 0) return sa;
      return a.nome.localeCompare(b.nome);
    });
  }, [produtosDoLocal]);

  const agrupados = useMemo(() => {
    const map = new Map<string, Map<string, typeof ordenados>>();
    for (const p of ordenados) {
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
  }, [ordenados]);

  const totalLocal = produtosDoLocal.length;
  const contadosLocal = produtosDoLocal.filter((p) => isFilled(p.id)).length;
  const progresso = totalLocal > 0 ? Math.round((contadosLocal / totalLocal) * 100) : 0;
  const totalContadosGeral = produtosAtivos.filter((p) => isFilled(p.id)).length;

  const focusNext = useCallback(
    (currentId: string) => {
      const idx = ordenados.findIndex((p) => p.id === currentId);
      const next = ordenados[idx + 1];
      if (next) inputsRef.current[next.id]?.focus();
    },
    [ordenados],
  );

  const marcarRestantesZero = () => {
    setQtds((cur) => {
      const next = { ...cur };
      for (const p of produtosDoLocal) {
        if (next[p.id] === undefined || next[p.id].trim() === "") next[p.id] = "0";
      }
      return next;
    });
  };

  const gerarRelatorio = () => {
    const filled = produtosAtivos.filter((p) => isFilled(p.id));
    if (filled.length === 0) {
      toast.error("Nenhuma quantidade preenchida ainda.");
      return;
    }
    // Agrupa por sub-local
    const porLocal = new Map<string, typeof filled>();
    for (const p of filled) {
      const key = p.default_sublocal_id ?? "sem-local";
      if (!porLocal.has(key)) porLocal.set(key, []);
      porLocal.get(key)!.push(p);
    }

    const linhas: string[] = [];
    linhas.push(`📋 Contagem de estoque — ${hojeBR()}`);
    linhas.push("Conferência (rascunho)");
    linhas.push("");

    const locaisOrdenados = Array.from(porLocal.keys()).sort((a, b) =>
      (localNomeById.get(a) ?? "Sem local").localeCompare(localNomeById.get(b) ?? "Sem local"),
    );
    for (const slId of locaisOrdenados) {
      const nomeLocal = localNomeById.get(slId) ?? "Sem local definido";
      linhas.push(`📍 ${nomeLocal.toUpperCase()}`);
      const itens = porLocal.get(slId)!.sort((a, b) => a.nome.localeCompare(b.nome));
      for (const p of itens) {
        const contado = Number(qtds[p.id]);
        const sist = saldoMap.get(`${p.id}:${slId}`) ?? 0;
        const dif = contado - sist;
        const difTxt = dif === 0 ? "ok" : dif > 0 ? `+${fmtQty(dif, "")}` : fmtQty(dif, "");
        linhas.push(`• ${p.nome}: ${fmtQty(contado, p.unidade)} (sist. ${fmtQty(sist, "")}, ${difTxt.trim()})`);
      }
      linhas.push("");
    }
    linhas.push(`Total: ${filled.length} item(ns) contado(s) em ${porLocal.size} local(is).`);
    linhas.push(`Gerado por ${user?.nome ?? "—"}.`);

    setRelatorio(linhas.join("\n"));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const copiar = async () => {
    if (!relatorio) return;
    try {
      await navigator.clipboard.writeText(relatorio);
      toast.success("Relatório copiado.");
    } catch {
      toast.error("Não consegui copiar. Selecione o texto manualmente.");
    }
  };

  const enviarWhatsapp = () => {
    if (!relatorio) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(relatorio)}`, "_blank");
  };

  const limparTudo = () => {
    setQtds({});
    setRelatorio(null);
    setSublocalId("");
    toast.success("Contagem limpa.");
  };

  if (!user) return null;

  return (
    <div className="space-y-4 pb-28">
      <Link to="/estoque" className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <ArrowLeft className="h-3 w-3" /> Estoque
      </Link>
      <div>
        <h1 className="font-display text-xl font-bold flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-primary" /> Contagem (rascunho)
        </h1>
        <p className="text-xs text-muted-foreground">
          Conferidor auxiliar — <strong>não altera o estoque</strong>. Conte por local e gere um relatório para enviar
          ao estoquista.
        </p>
      </div>

      {relatorio && (
        <Card className="border-primary/40">
          <CardContent className="space-y-3 p-3">
            <p className="text-xs font-semibold text-primary flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" /> Relatório pronto
            </p>
            <textarea
              readOnly
              value={relatorio}
              className="h-56 w-full resize-none rounded-md border bg-muted/40 p-2 font-mono text-[11px] leading-relaxed"
            />
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={copiar}>
                <Copy className="mr-2 h-4 w-4" /> Copiar
              </Button>
              <Button size="sm" onClick={enviarWhatsapp}>
                <Send className="mr-2 h-4 w-4" /> WhatsApp
              </Button>
            </div>
            <Button variant="ghost" size="sm" className="w-full" onClick={() => setRelatorio(null)}>
              Voltar para a contagem
            </Button>
          </CardContent>
        </Card>
      )}

      {!relatorio && (
        <>
          {totalContadosGeral > 0 && (
            <Card className="bg-primary/5">
              <CardContent className="flex items-center justify-between gap-2 p-3">
                <p className="text-xs text-muted-foreground">
                  <strong className="text-foreground">{totalContadosGeral}</strong> item(ns) contado(s) no total
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={gerarRelatorio}>
                    <FileText className="mr-1.5 h-3.5 w-3.5" /> Relatório
                  </Button>
                  <Button variant="ghost" size="sm" onClick={limparTudo}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
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
                      disabled={s.total === 0}
                      className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-left text-sm hover:bg-accent disabled:opacity-50"
                    >
                      <div className="min-w-0">
                        <p className="font-medium truncate">{s.localNome}</p>
                        <p className="text-[10px] text-muted-foreground">{s.total} produto(s)</p>
                      </div>
                      {s.contados > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[10px] rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-600">
                          <Check className="h-3 w-3" /> {s.contados}/{s.total}
                        </span>
                      ) : (
                        <span className="text-[10px] rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                          contar
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
                      <p className="text-xs text-muted-foreground">Contando em</p>
                      <p className="text-sm font-semibold truncate">{localNomeById.get(sublocalId)}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setSublocalId("")}>
                      Trocar local
                    </Button>
                  </div>
                  <Progress value={progresso} className="h-1.5" />
                  <p className="text-[10px] text-muted-foreground">
                    {contadosLocal} de {totalLocal} preenchido(s) ({progresso}%)
                  </p>
                  <Button variant="outline" size="sm" className="w-full" onClick={marcarRestantesZero}>
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
                            <p className="mb-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                              {subgrupo}
                            </p>
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
                                        sistema: {fmtQty(saldoAtual, p.unidade)}
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
                {produtosDoLocal.length === 0 && (
                  <Card>
                    <CardContent className="p-6 text-center text-sm text-muted-foreground">
                      Nenhum produto neste local.
                    </CardContent>
                  </Card>
                )}
              </div>
            </>
          )}

          <div className="fixed bottom-16 left-0 right-0 z-20 px-4">
            <Button className="w-full shadow-lg" size="lg" onClick={gerarRelatorio} disabled={totalContadosGeral === 0}>
              <FileText className="mr-2 h-4 w-4" />
              Gerar relatório {totalContadosGeral > 0 ? `(${totalContadosGeral})` : ""}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
