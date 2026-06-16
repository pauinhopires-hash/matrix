import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { fetchActivity, qk, type ActivityTipo } from "@/lib/activity-db";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({ meta: [{ title: "Perfil — Misturaria Control" }] }),
  component: PerfilPage,
});

function PerfilPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const { data: activity = [] } = useQuery({
    queryKey: qk.activity(user?.id),
    queryFn: () => fetchActivity(user!.id, 20),
    enabled: !!user,
  });

  if (!user) return null;

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="flex items-center gap-4 p-4">
          {user.fotoDataUrl ? (
            <img
              src={user.fotoDataUrl}
              alt={user.nome}
              className="h-16 w-16 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-xl font-semibold text-primary">
              {user.nome.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-display text-lg font-semibold">{user.nome}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            <p className="mt-1 text-[11px] uppercase tracking-wide text-primary">
              {user.cargo} · {user.setor}
            </p>
          </div>
        </CardContent>
      </Card>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Atividade recente
        </h2>
        <Card>
          <CardContent className="p-0">
            {activity.length === 0 ? (
              <p className="p-4 text-center text-sm text-muted-foreground">
                Nenhuma atividade ainda.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {activity.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between gap-3 p-3 text-xs"
                  >
                    <span className="capitalize">
                      {labelFor(a.tipo)}
                      {a.detalhe ? ` · ${a.detalhe}` : ""}
                    </span>
                    <span className="text-muted-foreground">
                      {new Date(a.created_at).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <Button
        variant="outline"
        size="lg"
        className="w-full"
        onClick={async () => {
          await logout();
          navigate({ to: "/login" });
        }}
      >
        <LogOut className="mr-2 h-4 w-4" />
        Sair
      </Button>
    </div>
  );
}

function labelFor(t: ActivityTipo): string {
  switch (t) {
    case "login":
      return "Entrou no sistema";
    case "logout":
      return "Saiu do sistema";
    case "checklist_item":
      return "Concluiu item";
    case "user_approved":
      return "Aprovou usuário";
    case "user_rejected":
      return "Recusou usuário";
    case "signup":
      return "Cadastro criado";
    default:
      return t;
  }
}
