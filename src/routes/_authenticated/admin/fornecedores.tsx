import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  fetchFornecedores,
  upsertFornecedor,
  toggleFornecedorAtivo,
  qk as comprasQk,
  type Fornecedor,
} from "@/lib/compras-db";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Plus, Pencil } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/fornecedores")({
  head: () => ({ meta: [{ title: "Fornecedores" }] }),
  component: FornecedoresPage,
});

interface FormState {
  id?: string;
  nome: string;
  contato: string;
  telefone: string;
  email: string;
  observacao: string;
  ativo: boolean;
}

function emptyForm(): FormState {
  return { nome: "", contato: "", telefone: "", email: "", observacao: "", ativo: true };
}

function FornecedoresPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editando, setEditando] = useState<FormState | null>(null);

  const { data: fornecedores = [] } = useQuery({
    queryKey: comprasQk.fornecedores,
    queryFn: fetchFornecedores,
  });

  const salvar = useMutation({
    mutationFn: upsertFornecedor,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: comprasQk.fornecedores });
      toast.success("Fornecedor salvo");
      setEditando(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: ({ id, ativo }: { id: string; ativo: boolean }) =>
      toggleFornecedorAtivo(id, ativo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: comprasQk.fornecedores });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!user) return null;
  const isStaff = user.role === "admin" || user.role === "gerente";
  if (!isStaff) return <Navigate to="/compras" />;

  function abrirNovo() {
    setEditando(emptyForm());
  }
  function abrirEdicao(f: Fornecedor) {
    setEditando({
      id: f.id,
      nome: f.nome,
      contato: f.contato ?? "",
      telefone: f.telefone ?? "",
      email: f.email ?? "",
      observacao: f.observacao ?? "",
      ativo: f.ativo,
    });
  }
  function submeter() {
    if (!editando) return;
    if (!editando.nome.trim()) return toast.error("Nome obrigatório");
    salvar.mutate({
      id: editando.id,
      nome: editando.nome.trim(),
      contato: editando.contato || null,
      telefone: editando.telefone || null,
      email: editando.email || null,
      observacao: editando.observacao || null,
      ativo: editando.ativo,
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <Link to="/compras" className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <ArrowLeft className="h-3 w-3" /> Compras
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <h1 className="font-display text-xl font-bold">Fornecedores</h1>
          <Button size="sm" onClick={abrirNovo}>
            <Plus className="mr-1 h-4 w-4" /> Novo
          </Button>
        </div>
      </div>

      {editando && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <Input
              placeholder="Nome*"
              value={editando.nome}
              onChange={(e) => setEditando({ ...editando, nome: e.target.value })}
            />
            <Input
              placeholder="Contato"
              value={editando.contato}
              onChange={(e) => setEditando({ ...editando, contato: e.target.value })}
            />
            <Input
              placeholder="Telefone"
              value={editando.telefone}
              onChange={(e) => setEditando({ ...editando, telefone: e.target.value })}
            />
            <Input
              placeholder="Email"
              type="email"
              value={editando.email}
              onChange={(e) => setEditando({ ...editando, email: e.target.value })}
            />
            <Textarea
              rows={2}
              placeholder="Observação"
              value={editando.observacao}
              onChange={(e) => setEditando({ ...editando, observacao: e.target.value })}
            />
            <label className="flex items-center justify-between text-sm">
              <span>Ativo</span>
              <Switch
                checked={editando.ativo}
                onCheckedChange={(v) => setEditando({ ...editando, ativo: v })}
              />
            </label>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setEditando(null)}>
                Cancelar
              </Button>
              <Button className="flex-1" onClick={submeter} disabled={salvar.isPending}>
                {salvar.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {fornecedores.length === 0 && !editando && (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              Nenhum fornecedor cadastrado.
            </CardContent>
          </Card>
        )}
        {fornecedores.map((f) => (
          <Card key={f.id} className={f.ativo ? "" : "opacity-60"}>
            <CardContent className="flex items-center gap-2 p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{f.nome}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {[f.contato, f.telefone, f.email].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              <Switch
                checked={f.ativo}
                onCheckedChange={(v) => toggle.mutate({ id: f.id, ativo: v })}
              />
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => abrirEdicao(f)}>
                <Pencil className="h-3 w-3" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
