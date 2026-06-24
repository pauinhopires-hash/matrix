import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useMemo, useState, type ChangeEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  CHECKLIST_META,
  TIPOS,
  type ChecklistTipo,
  fetchItens,
  fetchRegistros,
  upsertRegistro,
  uploadChecklistFoto,
  getChecklistFotoSignedUrl,
  groupBySetor,
  todayKey,
  qk,
} from "@/lib/checklists-db";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Camera,
  Check,
  Copy,
  FileText,
  Loader2,
  Lock,
  Send,
  X,
} from "lucide-react";
import { toast } from "sonner";

const VALID: ChecklistTipo[] = ["abertura", "meio", "fechamento"];
const sb = supabase as unknown as { from: (t: string) => any };

export const Route = createFileRoute("/_authenticated/checklist/$tipo")({
  parseParams: ({ tipo }) => {
    if (!VALID.includes(tipo as ChecklistTipo)) throw notFound();
    return { tipo: tipo as ChecklistTipo };
  },
  head: ({ params }) => ({
    meta: [{ title: `${CHECKLIST_META[params.tipo].titulo} — Misturaria Control` }],
  }),
  component: ChecklistPage,
});

function ChecklistPage() {
  const params = Route.useParams() as { tipo: ChecklistTipo };
  const tipo = params.tipo;
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const data = todayKey();

  const itensQuery = useQuery({
    queryKey: qk.itens(tipo),
    queryFn: () => fetchItens(tipo),
    enabled: !!user,
  });

  const registrosQuery = useQuery({
    queryKey: qk.registros(data),
    queryFn: () => fetchRegistros(data),
    enabled: !!user,
  });

  // Papéis (nomes) e papéis do usuário logado
  const rolesQuery = useQuery({
    queryKey: ["db", "checklist_roles", "all"],
    queryFn: async (): Promise<{ id: string; nome: string }[]> => {
      const { data: d, error } = await sb.from("checklist_roles").select("id, nome");
      if (error) throw new Error(error.message);
      return d ?? [];
    },
    enabled: !!user,
  });
  const myRolesQuery = useQuery({
    queryKey: ["db", "my_checklist_roles", user?.id],
    queryFn: async (): Promise<string[]> => {
      const { data: d, error } = await sb
        .from("checklist_role_users")
        .select("role_id")
        .eq("user_id", user!.id);
      if (error) throw new Error(error.message);
      return (d ?? []).map((r: { role_id: string }) => r.role_id);
    },
    enabled: !!user,
  });

  // Itens que exigem foto (para travar a conclusão)
  const exigeFotoQuery = useQuery({
    queryKey: ["db", "checklist_exige_foto", tipo],
    queryFn: async (): Promise<Record<string, boolean>> => {
      const { data: d, error } = await sb
        .from("checklist_itens")
        .select("id, exige_foto")
        .eq("tipo", tipo);
      if (error) throw new Error(error.message);
      const m: Record<string, boolean> = {};
      (d ?? []).forEach((r: { id: string; exige_foto: boolean | null }) => {
        m[r.id] = !!r.exige_foto;
      });
      return m;
    },
    enabled: !!user,
  });
  // Responsável individual (pessoa) por item, para este tipo
  const assignedUserQuery = useQuery({
    queryKey: ["db", "checklist_assigned_user", tipo],
    queryFn: async (): Promise<Record<string, string | null>> => {
      const { data: d, error } = await sb
        .from("checklist_itens")
        .select("id, assigned_user_id")
        .eq("tipo", tipo);
      if (error) throw new Error(error.message);
      const m: Record<string, string | null> = {};
      (d ?? []).forEach((r: { id: string; assigned_user_id: string | null }) => {
        m[r.id] = r.assigned_user_id;
      });
      return m;
    },
    enabled: !!user,
  });
  // Nomes (para o relatório: quem fez)
  const profilesQuery = useQuery({
    queryKey: ["db", "profiles_nomes"],
    queryFn: async (): Promise<{ id: string; nome: string }[]> => {
      const { data: d, error } = await supabase.from("profiles").select("id, nome");
      if (error) throw new Error(error.message);
      return (d ?? []) as { id: string; nome: string }[];
    },
    enabled: !!user,
  });

  const [relatorio, setRelatorio] = useState<string | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: qk.registros(data) });
  };

  // Concluir/desmarcar: grava done (done_by/done_at via camada) + executed_as_role_id (tabela nova)
  const toggleMut = useMutation({
    mutationFn: async (vars: { item_id: string; done: boolean; role_id: string | null }) => {
      await upsertRegistro({ item_id: vars.item_id, done: vars.done, data, tipo, user_id: user!.id });
      const { error } = await sb
        .from("checklist_registros")
        .update({ executed_as_role_id: vars.done ? vars.role_id : null })
        .eq("data", data)
        .eq("tipo", tipo)
        .eq("item_id", vars.item_id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const obsMut = useMutation({
    mutationFn: (vars: { item_id: string; observacao: string }) =>
      upsertRegistro({ ...vars, data, tipo, user_id: user!.id }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const fotoMut = useMutation({
    mutationFn: async (vars: { item_id: string; file: File | null }) => {
      let foto_url: string | null = null;
      if (vars.file) foto_url = await uploadChecklistFoto(vars.file, user!.id);
      await upsertRegistro({
        data,
        tipo,
        item_id: vars.item_id,
        foto_url,
        user_id: user!.id,
      });
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  if (!user) return null;
  const meta = CHECKLIST_META[tipo];
  const isStaff = user.role === "admin" || user.role === "gerente";

  const itens = itensQuery.data ?? [];
  const registros = registrosQuery.data ?? [];
  const roleById = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rolesQuery.data ?? []) m.set(r.id, r.nome);
    return m;
  }, [rolesQuery.data]);
  const myRoleIds = useMemo(() => new Set(myRolesQuery.data ?? []), [myRolesQuery.data]);
  const exigeFotoByItem = useMemo(() => exigeFotoQuery.data ?? {}, [exigeFotoQuery.data]);
  const assignedUserByItem = useMemo(() => assignedUserQuery.data ?? {}, [assignedUserQuery.data]);
  const nomeById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of profilesQuery.data ?? []) m.set(p.id, p.nome);
    return m;
  }, [profilesQuery.data]);

  // Visibilidade (RF05):
  // - admin/supervisor: todas as tarefas
  // - usuário comum: tarefas dos papéis dele + tarefas sem papel (gerais)
  const visiveis = useMemo(() => {
    if (isStaff) return itens;
    return itens.filter((it) => {
      // Pessoa definida tem prioridade: a tarefa é só dela.
      const uid = assignedUserByItem[it.id] ?? null;
      if (uid) return uid === user.id;
      const rid = (it as { assigned_role_id?: string | null }).assigned_role_id ?? null;
      return rid === null || myRoleIds.has(rid);
    });
  }, [itens, isStaff, myRoleIds, assignedUserByItem, user.id]);

  const groups = useMemo(() => groupBySetor(visiveis), [visiveis]);

  const registroMap = useMemo(() => {
    const m = new Map<string, (typeof registros)[number]>();
    for (const r of registros) if (r.tipo === tipo) m.set(r.item_id, r);
    return m;
  }, [registros, tipo]);

  const total = visiveis.length;
  const done = visiveis.filter((i) => registroMap.get(i.id)?.done).length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const tudoFeito = total > 0 && done === total;
  const faltam = visiveis.filter((i) => !registroMap.get(i.id)?.done);

  function onFile(item_id: string, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    fotoMut.mutate({ item_id, file });
  }

  // Trava na tela: não deixa concluir item que exige foto sem foto anexada.
  function handleToggle(item_id: string, v: boolean, role_id: string | null) {
    if (v && exigeFotoByItem[item_id] && !registroMap.get(item_id)?.foto_url) {
      toast.error("Tire a foto antes de concluir este item.");
      return;
    }
    toggleMut.mutate({ item_id, done: v, role_id });
  }

  function dataBR() {
    const [y, m, d] = data.split("-");
    return `${d}/${m}/${y}`;
  }

  function gerarRelatorio() {
    if (!tudoFeito) {
      toast.error("Conclua todos os itens (com foto onde for exigido) para gerar o relatório.");
      return;
    }
    const linhas: string[] = [];
    linhas.push(`✅ Checklist ${meta.titulo} — ${dataBR()}`);
    linhas.push("");
    for (const g of groups) {
      linhas.push(`*${g.setor}*`);
      for (const it of g.items) {
        const r = registroMap.get(it.id) as
          | { done_at?: string | null; done_by?: string | null; observacao?: string | null }
          | undefined;
        const hora = r?.done_at
          ? new Date(r.done_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
          : "--:--";
        const quem = r?.done_by ? nomeById.get(r.done_by) ?? "—" : "—";
        const foto = exigeFotoByItem[it.id] ? " 📷" : "";
        linhas.push(`• ${it.label}: ✓ ${hora} — ${quem}${foto}`);
        if (r?.observacao) linhas.push(`   obs: ${r.observacao}`);
      }
      linhas.push("");
    }
    linhas.push(`${done}/${total} itens concluídos.`);
    linhas.push(`Gerado por ${user?.nome ?? "usuário"}.`);
    setRelatorio(linhas.join("\n"));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const copiarRelatorio = async () => {
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

  const loading = itensQuery.isLoading || registrosQuery.isLoading;

  return (
    <div className="space-y-5 pb-28">
      {relatorio && (
        <Card className="border-primary/40">
          <CardContent className="space-y-3 p-3">
            <p className="flex items-center gap-1 text-xs font-semibold text-primary">
              <FileText className="h-3.5 w-3.5" /> Relatório do checklist
            </p>
            <textarea
              readOnly
              value={relatorio}
              className="h-56 w-full resize-none rounded-md border bg-muted/40 p-2 font-mono text-[11px] leading-relaxed"
            />
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={copiarRelatorio}>
                <Copy className="mr-2 h-4 w-4" /> Copiar
              </Button>
              <Button size="sm" onClick={enviarWhatsapp}>
                <Send className="mr-2 h-4 w-4" /> WhatsApp
              </Button>
            </div>
            <Button variant="ghost" size="sm" className="w-full" onClick={() => setRelatorio(null)}>
              Voltar ao checklist
            </Button>
          </CardContent>
        </Card>
      )}

      <div>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Dashboard
        </Link>
        <div className="mt-2 flex items-end justify-between gap-2">
          <div>
            <h1 className="font-display text-2xl font-bold">{meta.titulo}</h1>
            <p className="text-xs text-muted-foreground">{meta.descricao}</p>
          </div>
          <div className="text-right">
            <p className="font-display text-xl font-bold">
              {done}
              <span className="text-sm text-muted-foreground">/{total}</span>
            </p>
            <p className="text-[10px] text-muted-foreground">{pct}% feito</p>
          </div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {TIPOS.map((t) => (
          <Link
            key={t}
            to="/checklist/$tipo"
            params={{ tipo: t }}
            className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground data-[status=active]:border-primary data-[status=active]:bg-primary/10 data-[status=active]:text-primary"
            activeProps={{ "data-status": "active" } as never}
          >
            {CHECKLIST_META[t].titulo}
          </Link>
        ))}
      </div>

      {loading && (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </CardContent>
        </Card>
      )}

      {!loading && groups.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Nenhuma tarefa para você neste checklist.
          </CardContent>
        </Card>
      )}

      {groups.map((group) => (
        <section key={group.setor} className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {group.setor}
          </h2>
          <div className="space-y-2">
            {group.items.map((item) => {
              const rid = (item as { assigned_role_id?: string | null }).assigned_role_id ?? null;
              const uid = assignedUserByItem[item.id] ?? null;
              return (
                <ItemCard
                  key={item.id}
                  item={item}
                  papelNome={rid ? roleById.get(rid) ?? null : null}
                  pessoaNome={uid ? nomeById.get(uid) ?? null : null}
                  exigeFoto={!!exigeFotoByItem[item.id]}
                  registro={registroMap.get(item.id)}
                  onToggle={(v) => handleToggle(item.id, v, rid)}
                  onObs={(v) => obsMut.mutate({ item_id: item.id, observacao: v })}
                  onFile={(e) => onFile(item.id, e)}
                  onRemoveFoto={() => fotoMut.mutate({ item_id: item.id, file: null })}
                />
              );
            })}
          </div>
        </section>
      ))}

      {!loading && total > 0 && (
        <div className="fixed bottom-16 left-0 right-0 z-20 px-4">
          <Button
            className="w-full shadow-lg"
            size="lg"
            onClick={gerarRelatorio}
            disabled={!tudoFeito}
          >
            {tudoFeito ? (
              <>
                <FileText className="mr-2 h-4 w-4" /> Gerar relatório
              </>
            ) : (
              <>
                <Lock className="mr-2 h-4 w-4" /> Faltam {faltam.length} item(ns)
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

function ItemCard({
  item,
  papelNome,
  pessoaNome,
  exigeFoto,
  registro,
  onToggle,
  onObs,
  onFile,
  onRemoveFoto,
}: {
  item: { id: string; label: string };
  papelNome: string | null;
  pessoaNome: string | null;
  exigeFoto: boolean;
  registro:
    | {
        done: boolean;
        observacao: string | null;
        foto_url: string | null;
        done_at: string | null;
      }
    | undefined;
  onToggle: (v: boolean) => void;
  onObs: (v: string) => void;
  onFile: (e: ChangeEvent<HTMLInputElement>) => void;
  onRemoveFoto: () => void;
}) {
  const isDone = !!registro?.done;
  const temFoto = !!registro?.foto_url;
  const faltaFoto = exigeFoto && !temFoto;
  const [obsLocal, setObsLocal] = useState(registro?.observacao ?? "");

  const fotoQuery = useQuery({
    queryKey: ["checklist-foto", registro?.foto_url],
    queryFn: () => getChecklistFotoSignedUrl(registro!.foto_url!),
    enabled: !!registro?.foto_url,
    staleTime: 1000 * 60 * 30,
  });

  return (
    <Card className={isDone ? "border-success/30" : undefined}>
      <CardContent className="space-y-3 p-4">
        <label className="flex items-start gap-3">
          <Checkbox
            checked={isDone}
            disabled={faltaFoto}
            onCheckedChange={(v) => onToggle(v === true)}
            className="mt-0.5 h-6 w-6"
          />
          <div className="flex-1">
            <p
              className={`text-sm font-medium ${
                isDone ? "text-muted-foreground line-through" : ""
              }`}
            >
              {item.label}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-1">
              {pessoaNome && (
                <span className="inline-block rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold text-blue-600">
                  {pessoaNome}
                </span>
              )}
              {papelNome && (
                <span className="inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  {papelNome}
                </span>
              )}
              {faltaFoto && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
                  <Camera className="h-3 w-3" /> Foto obrigatória
                </span>
              )}
              {exigeFoto && temFoto && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                  <Check className="h-3 w-3" /> Foto ok
                </span>
              )}
            </div>
            {isDone && registro?.done_at && (
              <p className="mt-1 text-[10px] text-success">
                <Check className="mr-0.5 inline h-3 w-3" />
                {new Date(registro.done_at).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            )}
          </div>
        </label>

        <div className="flex items-start gap-2">
          <Textarea
            placeholder="Observação (opcional)"
            value={obsLocal}
            onChange={(e) => setObsLocal(e.target.value)}
            onBlur={() => {
              if (obsLocal !== (registro?.observacao ?? "")) onObs(obsLocal);
            }}
            rows={1}
            className="min-h-9 flex-1 text-xs"
          />
          <label
            htmlFor={`foto-${item.id}`}
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md border border-border text-muted-foreground"
          >
            <Camera className="h-4 w-4" />
          </label>
          <input
            id={`foto-${item.id}`}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onFile}
            className="hidden"
          />
        </div>

        {registro?.foto_url && fotoQuery.data && (
          <div className="relative">
            <img
              src={fotoQuery.data}
              alt=""
              className="max-h-40 w-full rounded-md object-cover"
            />
            <Button
              type="button"
              size="icon"
              variant="secondary"
              onClick={onRemoveFoto}
              className="absolute right-2 top-2 h-7 w-7"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
