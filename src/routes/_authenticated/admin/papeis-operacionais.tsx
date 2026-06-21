import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ArrowLeft, Plus, Pencil, Users, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/papeis-operacionais")({
  head: () => ({ meta: [{ title: "Papéis Operacionais" }] }),
  component: PapeisPage,
});

// Tipagem local (tabelas novas ainda não estão no types.ts gerado)
type Role = {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  created_at: string;
};
type RoleUser = { id: string; role_id: string; user_id: string };
type Profile = { id: string; nome: string; email: string };

// cliente sem tipo estrito p/ as tabelas novas
const sb = supabase as unknown as {
  from: (t: string) => any;
};

const qk = {
  roles: ["db", "checklist_roles"] as const,
  roleUsers: ["db", "checklist_role_users"] as const,
  profiles: ["db", "profiles_simple"] as const,
};

function PapeisPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const rolesQ = useQuery({
    queryKey: qk.roles,
    queryFn: async (): Promise<Role[]> => {
      const { data, error } = await sb.from("checklist_roles").select("*").order("nome");
      if (error) throw new Error(error.message);
      return (data ?? []) as Role[];
    },
  });
  const roleUsersQ = useQuery({
    queryKey: qk.roleUsers,
    queryFn: async (): Promise<RoleUser[]> => {
      const { data, error } = await sb
        .from("checklist_role_users")
        .select("id, role_id, user_id");
      if (error) throw new Error(error.message);
      return (data ?? []) as RoleUser[];
    },
  });
  const profilesQ = useQuery({
    queryKey: qk.profiles,
    queryFn: async (): Promise<Profile[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, email")
        .order("nome");
      if (error) throw new Error(error.message);
      return (data ?? []) as Profile[];
    },
  });

  const roles = rolesQ.data ?? [];
  const roleUsers = roleUsersQ.data ?? [];
  const profiles = profilesQ.data ?? [];

  const [editing, setEditing] = useState<
    { id?: string; nome: string; descricao: string } | null
  >(null);
  const [gerindo, setGerindo] = useState<Role | null>(null);

  const usersByRole = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const ru of roleUsers) {
      if (!m.has(ru.role_id)) m.set(ru.role_id, new Set());
      m.get(ru.role_id)!.add(ru.user_id);
    }
    return m;
  }, [roleUsers]);

  const salvarRole = useMutation({
    mutationFn: async (d: { id?: string; nome: string; descricao: string }) => {
      if (d.id) {
        const { error } = await sb
          .from("checklist_roles")
          .update({ nome: d.nome.trim(), descricao: d.descricao.trim() || null })
          .eq("id", d.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await sb
          .from("checklist_roles")
          .insert({ nome: d.nome.trim(), descricao: d.descricao.trim() || null });
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.roles });
      toast.success("Papel salvo");
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleAtivo = useMutation({
    mutationFn: async (r: Role) => {
      const { error } = await sb
        .from("checklist_roles")
        .update({ ativo: !r.ativo })
        .eq("id", r.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.roles });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleUser = useMutation({
    mutationFn: async (v: { roleId: string; userId: string; on: boolean }) => {
      if (v.on) {
        const { error } = await sb
          .from("checklist_role_users")
          .insert({ role_id: v.roleId, user_id: v.userId });
        if (error) throw new Error(error.message);
      } else {
        const { error } = await sb
          .from("checklist_role_users")
          .delete()
          .eq("role_id", v.roleId)
          .eq("user_id", v.userId);
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.roleUsers });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!user) return null;
  const podeEditar = user.role === "admin" || user.role === "gerente";

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Início
        </Link>
        <div className="flex items-center justify-between gap-2">
          <h1 className="font-display text-2xl font-bold">Papéis Operacionais</h1>
          {podeEditar && (
            <Button size="sm" onClick={() => setEditing({ nome: "", descricao: "" })}>
              <Plus className="mr-1 h-4 w-4" /> Novo
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Grupos de responsabilidade (ex.: Líder de Cozinha, Salão, Compras). Não são
          permissões — servem para distribuir tarefas.
        </p>
      </div>

      {!podeEditar && (
        <p className="text-xs text-muted-foreground">
          Apenas admin ou supervisor pode gerenciar papéis.
        </p>
      )}

      <div className="space-y-2">
        {roles.length === 0 && (
          <Card>
            <CardContent className="p-4 text-center text-sm text-muted-foreground">
              Nenhum papel ainda. Clique em "Novo".
            </CardContent>
          </Card>
        )}
        {roles.map((r) => {
          const qtd = usersByRole.get(r.id)?.size ?? 0;
          return (
            <Card key={r.id}>
              <CardContent className="flex items-center gap-2 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{r.nome}</p>
                  {r.descricao && (
                    <p className="truncate text-xs text-muted-foreground">{r.descricao}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground">
                    {qtd} usuário(s){r.ativo ? "" : " · inativo"}
                  </p>
                </div>
                {podeEditar && (
                  <>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => setGerindo(r)}
                      title="Usuários"
                    >
                      <Users className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() =>
                        setEditing({
                          id: r.id,
                          nome: r.nome,
                          descricao: r.descricao ?? "",
                        })
                      }
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleAtivo.mutate(r)}
                    >
                      {r.ativo ? "Desativar" : "Ativar"}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Dialog criar/editar papel */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar" : "Novo"} papel operacional</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">Nome</label>
                <Input
                  value={editing.nome}
                  onChange={(e) => setEditing({ ...editing, nome: e.target.value })}
                  placeholder="Ex.: Líder de Cozinha"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Descrição (opcional)</label>
                <Textarea
                  value={editing.descricao}
                  onChange={(e) =>
                    setEditing({ ...editing, descricao: e.target.value })
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() =>
                editing && editing.nome.trim()
                  ? salvarRole.mutate(editing)
                  : toast.error("Nome obrigatório")
              }
              disabled={salvarRole.isPending}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog gerenciar usuários do papel */}
      <Dialog open={!!gerindo} onOpenChange={(o) => !o && setGerindo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Usuários · {gerindo?.nome}</DialogTitle>
          </DialogHeader>
          <div className="max-h-80 space-y-1.5 overflow-y-auto">
            {profiles.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum usuário cadastrado.</p>
            )}
            {gerindo &&
              profiles.map((p) => {
                const on = usersByRole.get(gerindo.id)?.has(p.id) ?? false;
                return (
                  <button
                    key={p.id}
                    onClick={() =>
                      toggleUser.mutate({
                        roleId: gerindo.id,
                        userId: p.id,
                        on: !on,
                      })
                    }
                    className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm ${
                      on ? "border-primary bg-primary/10" : "border-border bg-card"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{p.nome}</p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {p.email}
                      </p>
                    </div>
                    {on && <Check className="h-4 w-4 shrink-0 text-primary" />}
                  </button>
                );
              })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGerindo(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
