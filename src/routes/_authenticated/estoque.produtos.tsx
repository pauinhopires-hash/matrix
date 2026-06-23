import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  fetchProdutos,
  upsertProduto,
  deleteProduto,
  fetchCategorias,
  fetchSubcategorias,
  fetchSublocais,
  UNIDADES,
  qk,
  type Produto,
} from "@/lib/estoque-db";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/estoque/produtos")({
  head: () => ({ meta: [{ title: "Produtos — Estoque" }] }),
  component: ProdutosPage,
});

type Draft = {
  id?: string;
  nome: string;
  unidade: string;
  subcategoria_id: string | null;
  default_sublocal_id: string | null;
  estoque_minimo: number;
  valor_unit: number | null;
  ativo: boolean;
  role_id: string | null;
};

const NONE = "__none__";

function ProdutosPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Draft | null>(null);

  const { data: produtos = [] } = useQuery({ queryKey: qk.produtos, queryFn: fetchProdutos });
  const { data: cats = [] } = useQuery({ queryKey: qk.categorias, queryFn: fetchCategorias });
  const { data: subs = [] } = useQuery({ queryKey: qk.subcategorias, queryFn: fetchSubcategorias });
  const { data: sublocais = [] } = useQuery({ queryKey: qk.sublocais, queryFn: fetchSublocais });
  const { data: papeis = [] } = useQuery({
    queryKey: ["db", "checklist_roles", "ativos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("checklist_roles")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      if (error) throw new Error(error.message);
      return (data ?? []) as { id: string; nome: string }[];
    },
  });

  const catById = useMemo(() => new Map(cats.map((c) => [c.id, c])), [cats]);

  // lista corrida agrupada por grupo > subgrupo
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
    return Array.from(map.entries()).map(([grupo, subs2]) => ({
      grupo,
      subgrupos: Array.from(subs2.entries()).map(([subgrupo, itens]) => ({ subgrupo, itens })),
    }));
  }, [produtos]);

  const mSave = useMutation({
    mutationFn: upsertProduto,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.produtos });
      toast.success("Salvo");
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const mDel = useMutation({
    mutationFn: deleteProduto,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.produtos });
      toast.success("Excluído");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!user) return null;
  const podeEditar = user.role === "admin" || user.role === "gerente";

  function novo() {
    setEditing({
      nome: "",
      unidade: "un",
      subcategoria_id: null,
      default_sublocal_id: null,
      estoque_minimo: 0,
      valor_unit: null,
      ativo: true,
      role_id: null,
    });
  }

  function salvar() {
    if (!editing) return;
    if (!editing.nome.trim()) return toast.error("Nome obrigatório");
    mSave.mutate({
      id: editing.id,
      nome: editing.nome.trim(),
      unidade: editing.unidade,
      subcategoria_id: editing.subcategoria_id,
      default_sublocal_id: editing.default_sublocal_id,
      estoque_minimo: Number(editing.estoque_minimo) || 0,
      valor_unit: editing.valor_unit,
      ativo: editing.ativo,
      role_id: editing.role_id,
    });
  }
  function excluir(p: Produto) {
    if (!confirm(`Excluir "${p.nome}"?`)) return;
    mDel.mutate(p.id);
  }
  function abrir(p: Produto) {
    setEditing({
      id: p.id,
      nome: p.nome,
      unidade: p.unidade,
      subcategoria_id: p.subcategoria_id,
      default_sublocal_id: p.default_sublocal_id,
      estoque_minimo: Number(p.estoque_minimo),
      valor_unit: p.valor_unit,
      ativo: p.ativo,
      role_id: p.role_id ?? null,
    });
  }

  const editSubsDisponiveis = subs;

  return (
    <div className="space-y-4 pb-6">
      <div>
        <Link to="/estoque" className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <ArrowLeft className="h-3 w-3" /> Estoque
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <h1 className="font-display text-xl font-bold">Produtos</h1>
          {podeEditar && (
            <Button size="sm" onClick={novo}>
              <Plus className="mr-1 h-4 w-4" /> Novo
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-5">
        {produtos.length === 0 && (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">Nenhum produto.</CardContent>
          </Card>
        )}
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
                      <Card key={p.id}>
                        <CardContent className="flex items-center gap-2 p-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{p.nome}</p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {p.unidade}
                              {p.valor_unit != null ? ` · R$ ${Number(p.valor_unit).toFixed(2)}` : ""}
                              {` · mín ${Number(p.estoque_minimo)}`}
                            </p>
                          </div>
                          {podeEditar && (
                            <>
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-8 w-8"
                                onClick={() => abrir(p)}
                                title="Editar"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              {user.role === "admin" && (
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="h-8 w-8 text-destructive"
                                  onClick={() => excluir(p)}
                                  title="Excluir"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar" : "Novo"} produto</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Nome</label>
                <Input value={editing.nome} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">Subcategoria</label>
                  <Select
                    value={editing.subcategoria_id ?? NONE}
                    onValueChange={(v) => setEditing({ ...editing, subcategoria_id: v === NONE ? null : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>—</SelectItem>
                      {editSubsDisponiveis.map((s) => {
                        const c = catById.get(s.categoria_id);
                        return (
                          <SelectItem key={s.id} value={s.id}>
                            {c?.nome ? `${c.nome} / ` : ""}
                            {s.nome}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Unidade</label>
                  <Select value={editing.unidade} onValueChange={(v) => setEditing({ ...editing, unidade: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNIDADES.map((u) => (
                        <SelectItem key={u} value={u}>
                          {u}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Sub-local padrão</label>
                <Select
                  value={editing.default_sublocal_id ?? NONE}
                  onValueChange={(v) => setEditing({ ...editing, default_sublocal_id: v === NONE ? null : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>—</SelectItem>
                    {sublocais.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">Estoque mínimo</label>
                  <Input
                    type="number"
                    value={editing.estoque_minimo}
                    onChange={(e) => setEditing({ ...editing, estoque_minimo: Number(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Valor unitário (R$)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editing.valor_unit ?? ""}
                    onChange={(e) =>
                      setEditing({ ...editing, valor_unit: e.target.value === "" ? null : Number(e.target.value) })
                    }
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={mSave.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
