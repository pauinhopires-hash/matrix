import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  CHECKLIST_META,
  TIPOS,
  type ChecklistTipo,
  type ChecklistItem,
  fetchSetores,
  fetchItens,
  addSetor,
  renameSetor,
  removeSetor,
  moveSetor,
  addItem,
  updateItem,
  removeItem,
  duplicateItem,
  replicateItemToSetores,
  groupBySetor,
  qk,
} from "@/lib/checklists-db";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  CopyPlus,
  MoveRight,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/checklists")({
  head: () => ({ meta: [{ title: "Gerenciar checklists — Misturaria Control" }] }),
  component: ChecklistsAdminPage,
});

type Aba = "itens" | "setores";

function ChecklistsAdminPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [aba, setAba] = useState<Aba>("itens");
  const [tipo, setTipo] = useState<ChecklistTipo>("abertura");
  const [novoLabel, setNovoLabel] = useState("");
  const [novoSetor, setNovoSetor] = useState<string>("");
  const [novoSetorNome, setNovoSetorNome] = useState("");

  const [replicItem, setReplicItem] = useState<ChecklistItem | null>(null);
  const [replicSel, setReplicSel] = useState<string[]>([]);

  const setoresQuery = useQuery({
    queryKey: qk.setores,
    queryFn: fetchSetores,
    enabled: !!user,
  });
  const itensQuery = useQuery({
    queryKey: qk.itens(tipo),
    queryFn: () => fetchItens(tipo),
    enabled: !!user,
  });
  const rolesQuery = useQuery({
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
    enabled: !!user,
  });
  const setRoleMut = useMutation({
    mutationFn: async (vars: { id: string; role_id: string | null }) => {
      const { error } = await (supabase as any)
        .from("checklist_itens")
        .update({ role_id: vars.role_id })
        .eq("id", vars.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.itensAll });
      toast.success("Responsável atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const invalidateItens = () =>
    queryClient.invalidateQueries({ queryKey: qk.itensAll });
  const invalidateSetores = () =>
    queryClient.invalidateQueries({ queryKey: qk.setores });

  const addItemMut = useMutation({
    mutationFn: addItem,
    onSuccess: () => {
      invalidateItens();
      toast.success("Item adicionado");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateItemMut = useMutation({
    mutationFn: (vars: { id: string; patch: Partial<ChecklistItem> }) =>
      updateItem(vars.id, vars.patch),
    onSuccess: invalidateItens,
    onError: (e: Error) => toast.error(e.message),
  });
  const removeItemMut = useMutation({
    mutationFn: removeItem,
    onSuccess: () => {
      invalidateItens();
      toast.success("Item removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const dupItemMut = useMutation({
    mutationFn: duplicateItem,
    onSuccess: () => {
      invalidateItens();
      toast.success("Item duplicado");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const replicateMut = useMutation({
    mutationFn: (vars: { item: ChecklistItem; setores: string[] }) =>
      replicateItemToSetores(vars.item, vars.setores),
    onSuccess: (_, vars) => {
      invalidateItens();
      toast.success(`Replicado em ${vars.setores.length} setor(es)`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addSetorMut = useMutation({
    mutationFn: (nome: string) => addSetor(nome),
    onSuccess: () => {
      invalidateSetores();
      toast.success("Setor criado");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const renameSetorMut = useMutation({
    mutationFn: (vars: { id: string; nome: string }) =>
      renameSetor(vars.id, vars.nome),
    onSuccess: () => {
      invalidateSetores();
      toast.success("Setor renomeado");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const removeSetorMut = useMutation({
    mutationFn: removeSetor,
    onSuccess: () => {
      invalidateSetores();
      toast.success("Setor removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const moveSetorMut = useMutation({
    mutationFn: (vars: { id: string; ordem: number }) =>
      moveSetor(vars.id, vars.ordem),
    onSuccess: invalidateSetores,
    onError: (e: Error) => toast.error(e.message),
  });

  if (!user) return null;
  if (user.role !== "admin") return <Navigate to="/dashboard" />;

  const setores = setoresQuery.data ?? [];
  const setorNomes = setores.map((s) => s.nome);
  const itens = itensQuery.data ?? [];
  const roles = rolesQuery.data ?? [];
  const groups = useMemo(() => groupBySetor(itens), [itens]);

  if (!novoSetor && setorNomes.length > 0) {
    setNovoSetor(setorNomes[0]);
  }

  function handleAdd() {
    const label = novoLabel.trim();
    if (!label) return toast.error("Digite o nome do item");
    if (!novoSetor) return toast.error("Escolha um setor");
    addItemMut.mutate({ tipo, setor: novoSetor, label });
    setNovoLabel("");
  }

  function handleRemove(item: ChecklistItem) {
    if (!confirm(`Remover "${item.label}"?`)) return;
    removeItemMut.mutate(item.id);
  }

  function handleMoveTipo(item: ChecklistItem, dest: ChecklistTipo) {
    updateItemMut.mutate({ id: item.id, patch: { tipo: dest } });
  }

  function openReplicate(item: ChecklistItem) {
    setReplicItem(item);
    setReplicSel([]);
  }

  function confirmReplicate() {
    if (!replicItem || replicSel.length === 0) {
      setReplicItem(null);
      return;
    }
    replicateMut.mutate({ item: replicItem, setores: replicSel });
    setReplicItem(null);
    setReplicSel([]);
  }

  function handleAddSetor() {
    const nome = novoSetorNome.trim();
    if (!nome) return toast.error("Digite o nome do setor");
    if (setorNomes.some((s) => s.toLowerCase() === nome.toLowerCase()))
      return toast.error("Setor já existe");
    addSetorMut.mutate(nome);
    setNovoSetorNome("");
  }

  function handleRenameSetor(id: string, antigo: string) {
    const novo = prompt(`Renomear "${antigo}" para:`, antigo);
    if (!novo || novo.trim() === antigo) return;
    renameSetorMut.mutate({ id, nome: novo.trim() });
  }

  function handleRemoveSetor(id: string, nome: string) {
    if (!confirm(`Excluir setor "${nome}"?`)) return;
    removeSetorMut.mutate(id);
  }

  function handleMoveSetor(idx: number, dir: "up" | "down") {
    const target = dir === "up" ? idx - 1 : idx + 1;
    if (target < 0 || target >= setores.length) return;
    const a = setores[idx];
    const b = setores[target];
    moveSetorMut.mutate({ id: a.id, ordem: b.ordem });
    moveSetorMut.mutate({ id: b.id, ordem: a.ordem });
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold">Gerenciar checklists</h1>
        <p className="text-xs text-muted-foreground">
          Controle total: itens, setores, duplicação e mudança de turno.
        </p>
      </div>

      <div className="flex gap-2 border-b border-border">
        {(["itens", "setores"] as Aba[]).map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setAba(a)}
            className={`-mb-px border-b-2 px-3 py-2 text-xs font-semibold uppercase tracking-wide transition ${
              aba === a
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground"
            }`}
          >
            {a === "itens" ? "Itens" : "Setores"}
          </button>
        ))}
      </div>

      {aba === "itens" && (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {TIPOS.map((t) => {
              const active = t === tipo;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipo(t)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {CHECKLIST_META[t].titulo}
                </button>
              );
            })}
          </div>

          <Card>
            <CardContent className="space-y-3 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Novo item
              </p>
              <Input
                placeholder="Ex.: Conferir gás"
                value={novoLabel}
                onChange={(e) => setNovoLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd();
                }}
              />
              <div className="flex gap-2">
                <Select value={novoSetor} onValueChange={(v) => setNovoSetor(v)}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Setor" />
                  </SelectTrigger>
                  <SelectContent>
                    {setorNomes.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleAdd} className="shrink-0">
                  <Plus className="mr-1 h-4 w-4" /> Adicionar
                </Button>
              </div>
            </CardContent>
          </Card>

          {itensQuery.isLoading && (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                Carregando…
              </CardContent>
            </Card>
          )}

          {!itensQuery.isLoading && groups.length === 0 && (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                Sem itens. Adicione o primeiro acima.
              </CardContent>
            </Card>
          )}

          {groups.map((group) => (
            <section key={group.setor} className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group.setor} ({group.items.length})
              </h2>
              <div className="space-y-2">
                {group.items.map((it) => (
                  <Card key={it.id}>
                    <CardContent className="space-y-2 p-3">
                      <Input
                        defaultValue={it.label}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v && v !== it.label) {
                            updateItemMut.mutate({ id: it.id, patch: { label: v } });
                          }
                        }}
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <Select
                          value={it.setor}
                          onValueChange={(v) =>
                            updateItemMut.mutate({ id: it.id, patch: { setor: v } })
                          }
                        >
                          <SelectTrigger className="h-8 min-w-[8rem] flex-1 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {setorNomes.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={tipo}
                          onValueChange={(v) =>
                            handleMoveTipo(it, v as ChecklistTipo)
                          }
                        >
                          <SelectTrigger className="h-8 min-w-[6.5rem] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TIPOS.map((t) => (
                              <SelectItem key={t} value={t}>
                                {CHECKLIST_META[t].titulo}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={(it as any).role_id ?? "__none__"}
                          onValueChange={(v) =>
                            setRoleMut.mutate({
                              id: it.id,
                              role_id: v === "__none__" ? null : v,
                            })
                          }
                        >
                          <SelectTrigger className="h-8 min-w-[8rem] text-xs">
                            <SelectValue placeholder="Responsável" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Sem responsável</SelectItem>
                            {roles.map((r) => (
                              <SelectItem key={r.id} value={r.id}>
                                {r.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => dupItemMut.mutate(it)}
                          className="h-8 w-8"
                          title="Duplicar"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => openReplicate(it)}
                          className="h-8 w-8"
                          title="Replicar em outros setores"
                        >
                          <CopyPlus className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => handleRemove(it)}
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          title="Remover"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </>
      )}

      {aba === "setores" && (
        <>
          <Card>
            <CardContent className="space-y-3 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Novo setor
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="Ex.: Forno, Pizzaiolo, Eventos VIP"
                  value={novoSetorNome}
                  onChange={(e) => setNovoSetorNome(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddSetor();
                  }}
                />
                <Button onClick={handleAddSetor} className="shrink-0">
                  <Plus className="mr-1 h-4 w-4" /> Criar
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-2">
            {setores.map((s, idx) => (
              <Card key={s.id}>
                <CardContent className="flex items-center gap-2 p-3">
                  <p className="flex-1 text-sm font-medium">{s.nome}</p>
                  <Button
                    size="icon"
                    variant="outline"
                    disabled={idx === 0}
                    onClick={() => handleMoveSetor(idx, "up")}
                    className="h-8 w-8"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    disabled={idx === setores.length - 1}
                    onClick={() => handleMoveSetor(idx, "down")}
                    className="h-8 w-8"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => handleRenameSetor(s.id, s.nome)}
                    className="h-8 w-8"
                    title="Renomear"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => handleRemoveSetor(s.id, s.nome)}
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    title="Excluir"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <Dialog open={replicItem !== null} onOpenChange={(o) => !o && setReplicItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MoveRight className="h-4 w-4" /> Replicar em outros setores
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[50vh] space-y-2 overflow-y-auto">
            {setorNomes.map((s) => {
              const checked = replicSel.includes(s);
              return (
                <label
                  key={s}
                  className="flex items-center gap-2 rounded-md border border-border p-2"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) =>
                      setReplicSel((sel) =>
                        v === true ? [...sel, s] : sel.filter((x) => x !== s),
                      )
                    }
                  />
                  <span className="text-sm">{s}</span>
                </label>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplicItem(null)}>
              Cancelar
            </Button>
            <Button
              onClick={confirmReplicate}
              disabled={replicSel.length === 0}
            >
              Replicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
