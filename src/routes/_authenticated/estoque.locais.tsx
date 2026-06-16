import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  fetchLocais, fetchSublocais,
  upsertLocal, deleteLocal,
  upsertSublocal, deleteSublocal,
  LIDER_LABEL, LIDERES, SUBLOCAL_TIPOS, qk,
  type Local, type SubLocal, type Lider, type SubLocalTipo,
} from "@/lib/estoque-db";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Pencil, Trash2, MapPin } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/estoque/locais")({
  head: () => ({ meta: [{ title: "Locais — Estoque" }] }),
  component: LocaisPage,
});

type LocalDraft = { id?: string; nome: string; responsavel: Lider | null };
type SubDraft = { id?: string; nome: string; local_id: string; tipo: SubLocalTipo; lider: Lider | null };

function LocaisPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editLocal, setEditLocal] = useState<LocalDraft | null>(null);
  const [editSub, setEditSub] = useState<SubDraft | null>(null);

  const { data: locais = [] } = useQuery({ queryKey: qk.locais, queryFn: fetchLocais });
  const { data: sublocais = [] } = useQuery({ queryKey: qk.sublocais, queryFn: fetchSublocais });

  const mLocal = useMutation({
    mutationFn: upsertLocal,
    onSuccess: () => { qc.invalidateQueries({ queryKey: qk.locais }); toast.success("Salvo"); setEditLocal(null); },
    onError: (e: Error) => toast.error(e.message),
  });
  const mDelLocal = useMutation({
    mutationFn: deleteLocal,
    onSuccess: () => { qc.invalidateQueries({ queryKey: qk.locais }); toast.success("Excluído"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const mSub = useMutation({
    mutationFn: upsertSublocal,
    onSuccess: () => { qc.invalidateQueries({ queryKey: qk.sublocais }); toast.success("Salvo"); setEditSub(null); },
    onError: (e: Error) => toast.error(e.message),
  });
  const mDelSub = useMutation({
    mutationFn: deleteSublocal,
    onSuccess: () => { qc.invalidateQueries({ queryKey: qk.sublocais }); toast.success("Excluído"); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!user) return null;
  const podeEditar = user.role === "admin" || user.role === "gerente";

  function salvarLocal() {
    if (!editLocal?.nome.trim()) return toast.error("Nome obrigatório");
    mLocal.mutate({ id: editLocal.id, nome: editLocal.nome.trim(), responsavel: editLocal.responsavel });
  }
  function salvarSub() {
    if (!editSub?.nome.trim()) return toast.error("Nome obrigatório");
    if (!editSub.local_id) return toast.error("Local obrigatório");
    mSub.mutate(editSub);
  }
  function excluirLocal(l: Local) {
    if (sublocais.some((s) => s.local_id === l.id)) return toast.error("Remova primeiro os sub-locais");
    if (!confirm(`Excluir local "${l.nome}"?`)) return;
    mDelLocal.mutate(l.id);
  }
  function excluirSub(s: SubLocal) {
    if (!confirm(`Excluir sub-local "${s.nome}"?`)) return;
    mDelSub.mutate(s.id);
  }

  return (
    <div className="space-y-4">
      <div>
        <Link to="/estoque" className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <ArrowLeft className="h-3 w-3" /> Estoque
        </Link>
        <h1 className="mt-2 font-display text-xl font-bold flex items-center gap-2">
          <MapPin className="h-5 w-5" /> Locais e sub-locais
        </h1>
        <p className="text-xs text-muted-foreground">Cada sub-local tem um líder responsável.</p>
      </div>

      {podeEditar && (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setEditLocal({ nome: "", responsavel: "lider_cozinha" })}>
            <Plus className="mr-1 h-4 w-4" /> Local
          </Button>
          <Button size="sm" variant="outline" disabled={locais.length === 0}
            onClick={() => setEditSub({ nome: "", local_id: locais[0]?.id ?? "", tipo: "prateleira", lider: "lider_cozinha" })}>
            <Plus className="mr-1 h-4 w-4" /> Sub-local
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {locais.length === 0 && (
          <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Nenhum local.</CardContent></Card>
        )}
        {locais.map((l) => {
          const subs = sublocais.filter((s) => s.local_id === l.id);
          return (
            <Card key={l.id}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">{l.nome}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {l.responsavel ? LIDER_LABEL[l.responsavel] : "Sem responsável"} · {subs.length} sub-local(is)
                    </p>
                  </div>
                  {podeEditar && (
                    <div className="flex gap-1">
                      <Button size="icon" variant="outline" className="h-7 w-7"
                        onClick={() => setEditLocal({ id: l.id, nome: l.nome, responsavel: l.responsavel })}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="outline" className="h-7 w-7 text-destructive" onClick={() => excluirLocal(l)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  {subs.map((s) => (
                    <div key={s.id} className="flex items-center justify-between rounded border border-border bg-muted/30 px-2 py-1.5 text-xs">
                      <div>
                        <span className="font-medium">{s.nome}</span>
                        <span className="ml-2 text-[10px] text-muted-foreground">
                          {s.tipo} · {s.lider ? LIDER_LABEL[s.lider] : "—"}
                        </span>
                      </div>
                      {podeEditar && (
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-6 w-6"
                            onClick={() => setEditSub({ id: s.id, nome: s.nome, local_id: s.local_id, tipo: s.tipo, lider: s.lider })}>
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

      <Dialog open={!!editLocal} onOpenChange={(o) => !o && setEditLocal(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editLocal?.id ? "Editar" : "Novo"} local</DialogTitle></DialogHeader>
          {editLocal && (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Nome</label>
                <Input value={editLocal.nome} onChange={(e) => setEditLocal({ ...editLocal, nome: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Responsável principal</label>
                <Select value={editLocal.responsavel ?? ""} onValueChange={(v) => setEditLocal({ ...editLocal, responsavel: v as Lider })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {LIDERES.map((l) => <SelectItem key={l} value={l}>{LIDER_LABEL[l]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditLocal(null)}>Cancelar</Button>
            <Button onClick={salvarLocal} disabled={mLocal.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editSub} onOpenChange={(o) => !o && setEditSub(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editSub?.id ? "Editar" : "Novo"} sub-local</DialogTitle></DialogHeader>
          {editSub && (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Nome</label>
                <Input value={editSub.nome} onChange={(e) => setEditSub({ ...editSub, nome: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Local</label>
                <Select value={editSub.local_id} onValueChange={(v) => setEditSub({ ...editSub, local_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {locais.map((l) => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">Tipo</label>
                  <Select value={editSub.tipo} onValueChange={(v) => setEditSub({ ...editSub, tipo: v as SubLocalTipo })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SUBLOCAL_TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Líder</label>
                  <Select value={editSub.lider ?? ""} onValueChange={(v) => setEditSub({ ...editSub, lider: v as Lider })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LIDERES.map((l) => <SelectItem key={l} value={l}>{LIDER_LABEL[l]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
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
