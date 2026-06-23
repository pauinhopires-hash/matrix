import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Minus, Plus, Check, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

// Cliente sem tipo estrito p/ tabelas/colunas ainda não refletidas no types.ts gerado
const sb = supabase as unknown as { from: (t: string) => any };

export const Route = createFileRoute("/_authenticated/compras/pedido")({
  component: PedidoPage,
});

type Produto = {
  id: string;
  nome: string;
  unidade: string;
  grupo: string | null;
  subgrupo: string | null;
  role_id: string | null;
};

type Papel = { id: string; nome: string };

function PedidoPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [papeis, setPapeis] = useState<Papel[]>([]);
  const [estoque, setEstoque] = useState<Record<string, number>>({});
  const [carregando, setCarregando] = useState(true);
  const [quantidades, setQuantidades] = useState<Record<string, number>>({});
  const [unidadesOverride, setUnidadesOverride] = useState<Record<string, string>>({});
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState("");
  const [grupoFiltro, setGrupoFiltro] = useState<string>("");
  const [papelFiltro, setPapelFiltro] = useState<string>("");

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setCarregando(true);
      const [{ data: prods, error: e1 }, { data: sal }, { data: roles }, { data: meusPapeis }] =
        await Promise.all([
          sb.from("produtos").select("id, nome, unidade, grupo, subgrupo, role_id").eq("ativo", true).order("nome"),
          supabase.from("saldos").select("produto_id, quantidade"),
          sb.from("checklist_roles").select("id, nome").eq("ativo", true).order("nome"),
          sb.from("checklist_role_users").select("role_id").eq("user_id", user.id),
        ]);
      if (e1) toast.error("Erro ao carregar produtos", { description: e1.message });
      setProdutos((prods ?? []) as Produto[]);
      setPapeis((roles ?? []) as Papel[]);
      const map: Record<string, number> = {};
      (sal ?? []).forEach((r: { produto_id: string; quantidade: number }) => {
        map[r.produto_id] = (map[r.produto_id] ?? 0) + Number(r.quantidade);
      });
      setEstoque(map);
      // Auto-seleção: se o usuário tem exatamente 1 papel, já filtra por ele
      const meus = (meusPapeis ?? []) as { role_id: string }[];
      if (meus.length === 1) setPapelFiltro(meus[0].role_id);
      setCarregando(false);
    })();
  }, [user]);

  const setQtd = (id: string, valor: number) => {
    setQuantidades((q) => {
      const novo = { ...q };
      if (valor <= 0) delete novo[id];
      else novo[id] = valor;
      return novo;
    });
  };

  const repetirUltimo = async () => {
    if (!user) return;
    const { data: req } = await sb
      .from("requisicoes_compra")
      .select("id")
      .eq("usuario_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!req) {
      toast.info("Nenhum pedido anterior encontrado");
      return;
    }
    const { data: itens } = await sb
      .from("requisicao_compra_itens")
      .select("produto_id, quantidade")
      .eq("requisicao_id", req.id);
    if (!itens || itens.length === 0) {
      toast.info("Pedido anterior estava vazio");
      return;
    }
    const map: Record<string, number> = {};
    itens.forEach((i: { produto_id: string; quantidade: number }) => {
      if (i.produto_id) map[i.produto_id] = Number(i.quantidade);
    });
    setQuantidades(map);
    toast.success(`${itens.length} itens carregados do último pedido`);
  };

  const itensSelecionados = useMemo(() => Object.entries(quantidades).filter(([, v]) => v > 0), [quantidades]);

  const produtosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return produtos.filter((p) => {
      if (grupoFiltro && (p.grupo ?? "Outros") !== grupoFiltro) return false;
      if (papelFiltro) {
        if (papelFiltro === "__none__") {
          if (p.role_id) return false;
        } else if (p.role_id !== papelFiltro) {
          return false;
        }
      }
      if (q && !p.nome.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [produtos, busca, grupoFiltro, papelFiltro]);

  const temSemPapel = useMemo(() => produtos.some((p) => !p.role_id), [produtos]);

  const gruposDisponiveis = useMemo(() => {
    const set = new Set<string>();
    produtos.forEach((p) => set.add(p.grupo ?? "Outros"));
    return Array.from(set).sort();
  }, [produtos]);

  const produtosAgrupados = useMemo(() => {
    const map = new Map<string, Map<string, Produto[]>>();
    produtosFiltrados.forEach((p) => {
      const g = p.grupo ?? "Outros";
      const sg = p.subgrupo ?? "—";
      if (!map.has(g)) map.set(g, new Map());
      const sub = map.get(g)!;
      if (!sub.has(sg)) sub.set(sg, []);
      sub.get(sg)!.push(p);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([grupo, subs]) => ({
        grupo,
        subgrupos: Array.from(subs.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([subgrupo, itens]) => ({ subgrupo, itens })),
      }));
  }, [produtosFiltrados]);

  const handleSalvar = async () => {
    if (!user || itensSelecionados.length === 0) return;
    setSalvando(true);

    const { data: req, error: e1 } = await sb
      .from("requisicoes_compra")
      .insert({
        usuario_id: user.id,
        observacao: observacao.trim() || null,
        status: "pendente",
      })
      .select("id")
      .single();

    if (e1 || !req) {
      toast.error("Erro ao criar pedido", { description: e1?.message });
      setSalvando(false);
      return;
    }

    const itens = itensSelecionados.map(([produto_id, quantidade]) => ({
      requisicao_id: req.id,
      produto_id,
      quantidade,
      unidade: unidadesOverride[produto_id] || null,
    }));

    const { error: e2 } = await sb.from("requisicao_compra_itens").insert(itens);
    setSalvando(false);
    if (e2) {
      toast.error("Erro ao salvar itens", { description: e2.message });
      return;
    }
    toast.success("Pedido enviado", { description: `${itens.length} itens registrados.` });
    navigate({ to: "/compras" });
  };

  if (loading || !user) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Carregando...</p>;
  }

  return (
    <div className="pb-28">
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={() => navigate({ to: "/compras" })}
          className="rounded-md p-2 text-muted-foreground transition hover:bg-card hover:text-foreground"
          aria-label="Voltar"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <p className="text-xs uppercase tracking-widest text-primary">Nova requisição</p>
          <h1 className="text-lg font-bold text-foreground">Fazer pedido</h1>
        </div>
        <button
          onClick={repetirUltimo}
          className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition hover:border-primary"
        >
          <RotateCcw size={14} />
          Repetir
        </button>
      </div>

      {papeis.length > 0 && (
        <div className="mb-4">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-primary">
            Setor / Perfil{user?.nome ? ` (${user.nome})` : ""}
          </p>
          <select
            value={papelFiltro}
            onChange={(e) => setPapelFiltro(e.target.value)}
            className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm font-medium text-foreground outline-none focus:border-primary"
          >
            <option value="">Todos os setores</option>
            {papeis.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
            {temSemPapel && <option value="__none__">Sem papel definido</option>}
          </select>
        </div>
      )}


      {gruposDisponiveis.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={() => setGrupoFiltro("")}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition ${
              grupoFiltro === ""
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:border-primary"
            }`}
          >
            Todos
          </button>
          {gruposDisponiveis.map((g) => (
            <button
              key={g}
              onClick={() => setGrupoFiltro(g)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition ${
                grupoFiltro === g
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:border-primary"
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      )}

      {carregando ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Carregando produtos...</p>
      ) : produtosFiltrados.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Nada encontrado.</p>
      ) : (
        <div className="space-y-6">
          {produtosAgrupados.map(({ grupo, subgrupos }) => (
            <section key={grupo}>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-primary">{grupo}</h2>
              <div className="space-y-4">
                {subgrupos.map(({ subgrupo, itens }) => (
                  <div key={subgrupo}>
                    {subgrupos.length > 1 || subgrupo !== "—" ? (
                      <p className="mb-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">{subgrupo}</p>
                    ) : null}
                    <ul className="space-y-2">
                      {itens.map((p) => {
                        const qtd = quantidades[p.id] ?? 0;
                        const ativo = qtd > 0;
                        const est = estoque[p.id];
                        const unidadeAtual = (unidadesOverride[p.id] || p.unidade).toUpperCase();
                        const unidadeOriginal = p.unidade.toUpperCase();
                        const alterada = unidadeAtual !== unidadeOriginal;
                        const fracionavel = ["KG", "LT"].includes(unidadeAtual);
                        const step = fracionavel ? 0.1 : 1;
                        const arred = (v: number) => (fracionavel ? Math.round(v * 1000) / 1000 : Math.round(v));
                        return (
                          <li
                            key={p.id}
                            className={`flex items-center justify-between rounded-xl border bg-card px-4 py-3 transition ${
                              ativo ? "border-primary/60" : "border-border"
                            }`}
                          >
                            <div className="min-w-0 flex-1 pr-3">
                              <p className="truncate text-sm font-semibold text-foreground">{p.nome}</p>
                              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                                <span>Unid.:</span>
                                <select
                                  value={unidadeAtual}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setUnidadesOverride((u) => {
                                      const novo = { ...u };
                                      if (v.toUpperCase() === unidadeOriginal) delete novo[p.id];
                                      else novo[p.id] = v;
                                      return novo;
                                    });
                                  }}
                                  className={`rounded border bg-background px-1.5 py-0.5 text-[11px] font-semibold uppercase outline-none focus:border-primary ${
                                    alterada ? "border-primary text-primary" : "border-border text-foreground"
                                  }`}
                                >
                                  {["UND", "KG", "CX", "PC", "PCT", "LT"].map((u) => (
                                    <option key={u} value={u}>
                                      {u}
                                      {u === unidadeOriginal ? " (padrão)" : ""}
                                    </option>
                                  ))}
                                </select>
                                {fracionavel && <span>(aceita decimal)</span>}
                                {est !== undefined && (
                                  <span className={est <= 0 ? "text-destructive" : "text-foreground/70"}>
                                    · Estoque: {est}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setQtd(p.id, Math.max(0, arred(qtd - step)))}
                                disabled={qtd === 0}
                                className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-foreground transition hover:border-primary disabled:opacity-40"
                                aria-label="Diminuir"
                              >
                                <Minus size={14} />
                              </button>
                              <input
                                type="number"
                                inputMode="decimal"
                                min={0}
                                step={step}
                                value={qtd === 0 ? "" : qtd}
                                onChange={(e) => {
                                  const v = Number(e.target.value.replace(",", "."));
                                  setQtd(p.id, Number.isFinite(v) && v > 0 ? arred(v) : 0);
                                }}
                                placeholder="0"
                                className="h-9 w-16 rounded-md border border-border bg-background text-center text-sm font-semibold tabular-nums text-foreground outline-none focus:border-primary"
                              />
                              <button
                                onClick={() => setQtd(p.id, arred(qtd + step))}
                                className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground transition hover:opacity-90"
                                aria-label="Aumentar"
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {itensSelecionados.length > 0 && (
        <div className="mt-6">
          <label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">
            Observação (opcional)
          </label>
          <textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-md border border-border bg-card px-4 py-3 text-sm text-foreground outline-none focus:border-primary"
            placeholder="Marca preferida, urgência, etc."
          />
        </div>
      )}

      {itensSelecionados.length > 0 && (
        <div className="fixed inset-x-0 bottom-20 z-20 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-md items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Itens selecionados</p>
              <p className="text-lg font-bold text-foreground">{itensSelecionados.length}</p>
            </div>
            <button
              onClick={handleSalvar}
              disabled={salvando}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-4 text-sm font-bold uppercase tracking-widest text-primary-foreground transition hover:opacity-95 disabled:opacity-60"
            >
              <Check size={18} />
              {salvando ? "Enviando..." : "Enviar pedido"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
