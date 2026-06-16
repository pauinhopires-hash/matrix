import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  fetchCategorias, fetchSubcategorias,
  upsertCategoria, deleteCategoria,
  upsertSubcategoria, deleteSubcategoria,
  qk, type Categoria, type Subcategoria,
} from "@/lib/estoque-db";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Pencil, Trash2, Tags } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/estoque/categorias")({
  head: () => ({ meta: [{ title: "Categorias — Estoque" }] }),
  component: CategoriasPage,
});

type CatDraft = { id?: string; nome: string };
type SubDraft = { id?: string; nome: string; categoria_id: string };

function CategoriasPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editCat, setEditCat] = useState<CatDraft | null>(null);
  const [editSub, setEditSub] = useState<SubDraft | null>(null);

  const { data: cats = [] } = useQuery({ queryKey: qk.categorias, queryFn: fetchCategorias });
  const { data: subs = [] } = useQuery({ queryKey: qk.subcategorias, queryFn: fetchSubcategorias });

  const mCat = useMutation({
    mutationFn: upsertCategoria,
    onSuccess: () => { qc.invalidateQueries({ queryKey: qk.categorias }); toast.success("Salvo"); setEditCat(null); },
    onError: (e: Error) => toast.error(e.message),
  });
  const mDelCat = useMutation({
    mutationFn: deleteCategoria,
    onSuccess: () => { qc.invalidateQueries({ queryKey: qk.categorias }); toast.success("Excluído"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const mSub = useMutation({
    mutationFn: upsertSubcategoria,
    onSuccess: () => { qc.invalidateQueries({ queryKey: qk.subcategorias }); toast.success("Salvo"); setEditSub(null); },
    onError: (e: Error) => toast.error(e.message),
  });
  const mDelSub = useMutation({
    mutationFn: deleteSubcategoria,
    onSuccess: () => { qc.invalidateQueries({ queryKey: qk.subcategorias }); toast.success("Excluído"); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!user) return null;
  const podeEditar = user.role === "admin" || user.role === "gerente";

  function salvarCat() {
    if (!editCat?.nome.trim()) return toast.error("Nome obrigatório");
    mCat.mutate({ id: editCat.id, nome: editCat.nome.trim() });
  }
  function salvarSub() {
    if (!editSub?.nome.trim()) return toast.error("Nome obrigatório");
    if (!editSub.categoria_id) return toast.error("Categoria obrigatória");
    mSub.mutate({ id: editSub.id, nome: editSub.nome.trim(), categoria_id: editSub.categoria_id });
  }
  function excluirCat(c: Categoria) {
    if (subs.some((s) => s.categoria_id === c.id)) return toast.error("Remova primeiro as subcategorias");
    if (!confirm(`Excluir categoria "${c.nome}"?`)) return;
    mDelCat.mutate(c.id);
  }
  function excluirSub(s: Subcategoria) {
    if (!confirm(`Excluir "${s.nome}"?`)) return;
    mDelSub.mutate(s.id);
  }

  return (
    <div className="space-y-4">
      <div>
        <Link to="/estoque" className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <ArrowLeft className="h-3 w-3" /> Estoque
        </Link>
        <h1 className="mt-2 font-display text-xl font-bold flex items-center gap-2">
          <Tags className="h-5 w-5" /> Categorias
        </h1>
      </div>

      {podeEditar && (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setEditCat({ nome: "" })}>
            <Plus className="mr-1 h-4 w-4" /> Categoria
          </Button>
          <Button size="sm" variant="outline" disabled={cats.length === 0}
            onClick={() => setEditSub({ nome: "", categoria_id: cats[0]?.id ?? "" })}>
            <Plus className="mr-1 h-4 w-4" /> Subcategoria
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {cats.length === 0 && (
          <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
            Nenhuma categoria. Crie aqui ou use "Importar" mais tarde.
          </CardContent></Card>
        )}
        {cats.map((c) => {
          const cs = subs.filter((s) => s.categoria_id === c.id);
          return (
            <Card key={c.id}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{c.nome}</p>
                  {podeEditar && (
                    <div className="flex gap-1">
                      <Button size="icon" variant="outline" className="h-7 w-7"
                        onClick={() => setEditCat({ id: c.id, nome: c.nome })}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="outline" className="h-7 w-7 text-destructive" onClick={() => excluirCat(c)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  {cs.map((s) => (
                    <div key={s.id} className="flex items-center justify-between rounded border border-border bg-muted/30 px-2 py-1.5 text-xs">
                      <span>{s.nome}</span>
                      {podeEditar && (
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-6 w-6"
                            onClick={() => setEditSub({ id: s.id, nome: s.nome, categoria_id: s.categoria_id })}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => excluirSub(s)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!editCat} onOpenChange={(o) => !o && setEditCat(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editCat?.id ? "Editar" : "Nova"} categoria</DialogTitle></DialogHeader>
          {editCat && (
            <Input value={editCat.nome} onChange={(e) => setEditCat({ ...editCat, nome: e.target.value })} placeholder="Nome" />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCat(null)}>Cancelar</Button>
            <Button onClick={salvarCat} disabled={mCat.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editSub} onOpenChange={(o) => !o && setEditSub(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editSub?.id ? "Editar" : "Nova"} subcategoria</DialogTitle></DialogHeader>
          {editSub && (
            <div className="space-y-3">
              <Input value={editSub.nome} onChange={(e) => setEditSub({ ...editSub, nome: e.target.value })} placeholder="Nome" />
              <Select value={editSub.categoria_id} onValueChange={(v) => setEditSub({ ...editSub, categoria_id: v })}>
                <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
                <SelectContent>
                  {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSub(null)}>Cancelar</Button>
            <Button onClick={salvarSub} disabled={mSub.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
