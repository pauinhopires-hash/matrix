import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, ListChecks, X, Shield } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Role } from "@/lib/types";
import { logActivity } from "@/lib/activity-db";

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  head: () => ({ meta: [{ title: "Equipe — Misturaria Control" }] }),
  component: UsuariosPage,
});

type DbStatus = "pending" | "active" | "rejected";
interface ProfileRow {
  id: string;
  nome: string;
  email: string;
  cargo: string | null;
  setor: string | null;
  status: DbStatus;
  foto_url: string | null;
}

interface UserWithRole extends ProfileRow {
  roles: Role[];
}

const ROLES: Role[] = ["admin", "gerente", "cozinha", "atendimento", "caixa"];

function UsuariosPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "usuarios"],
    queryFn: async (): Promise<UserWithRole[]> => {
      const [{ data: profiles, error: pErr }, { data: roles, error: rErr }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, nome, email, cargo, setor, status, foto_url")
          .order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (pErr) throw pErr;
      if (rErr) throw rErr;
      const rolesByUser = new Map<string, Role[]>();
      for (const r of roles ?? []) {
        const list = rolesByUser.get(r.user_id) ?? [];
        list.push(r.role as Role);
        rolesByUser.set(r.user_id, list);
      }
      return (profiles ?? []).map((p) => ({
        ...(p as ProfileRow),
        roles: rolesByUser.get(p.id) ?? [],
      }));
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status, nome }: { id: string; status: "active" | "rejected"; nome: string }) => {
      const { error } = await supabase.from("profiles").update({ status }).eq("id", id);
      if (error) throw error;
      logActivity({
        tipo: status === "active" ? "user_approved" : "user_rejected",
        nome: user?.nome ?? "—",
        user_id: user?.id,
        detalhe: nome,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "usuarios"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const setRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: Role }) => {
      const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", userId);
      if (delErr) throw delErr;
      const { error: insErr } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (insErr) throw insErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "usuarios"] });
      toast.success("Papel atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!user) return null;
  if (user.role !== "admin" && user.role !== "gerente") {
    return <Navigate to="/dashboard" />;
  }

  const users = data ?? [];
  const pending = users.filter((u) => u.status === "pending");
  const active = users.filter((u) => u.status === "active");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold">Equipe</h1>
        <p className="text-xs text-muted-foreground">
          Aprovar cadastros, atribuir papéis e visualizar funcionários ativos.
        </p>
      </div>

      {user.role === "admin" && (
        <Link to="/admin/checklists" className="block">
          <Card className="transition active:scale-[0.99]">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <ListChecks className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">Gerenciar checklists</p>
                <p className="text-xs text-muted-foreground">
                  Itens, setores, duplicar, mover de turno
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
      )}

      {isLoading && (
        <p className="text-center text-sm text-muted-foreground">Carregando...</p>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Pendentes ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-center text-sm text-muted-foreground">
              Sem cadastros pendentes.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {pending.map((u) => (
              <Card key={u.id}>
                <CardContent className="flex items-center gap-3 p-3">
                  <Avatar u={u} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{u.nome}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {u.cargo ?? "—"} · {u.setor ?? "—"}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() =>
                      setStatus.mutate({ id: u.id, status: "rejected", nome: u.nome })
                    }
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    onClick={() =>
                      setStatus.mutate({ id: u.id, status: "active", nome: u.nome })
                    }
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Ativos ({active.length})
        </h2>
        <div className="space-y-2">
          {active.map((u) => (
            <Card key={u.id}>
              <CardContent className="flex items-center gap-3 p-3">
                <Avatar u={u} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{u.nome}</p>
                  <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                </div>
                {user.role === "admin" ? (
                  <Select
                    value={u.roles[0] ?? ""}
                    onValueChange={(v) => setRole.mutate({ userId: u.id, role: v as Role })}
                  >
                    <SelectTrigger className="h-8 w-32">
                      <SelectValue placeholder="Sem papel" />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                    <Shield className="h-3 w-3" />
                    {u.roles[0] ?? "—"}
                  </span>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

function Avatar({ u }: { u: ProfileRow }) {
  if (u.foto_url) {
    return <img src={u.foto_url} alt="" className="h-10 w-10 rounded-full object-cover" />;
  }
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-semibold">
      {u.nome.slice(0, 1).toUpperCase()}
    </div>
  );
}
