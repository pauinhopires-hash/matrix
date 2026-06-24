import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Check, Clock, History, RotateCcw, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/auditoria")({
  head: () => ({ meta: [{ title: "Auditoria de Checklists" }] }),
  component: AuditoriaPage,
});

const sb = supabase as unknown as { from: (t: string) => any };

type Registro = {
  data: string;
  tipo: string;
  item_id: string;
  done: boolean;
  observacao: string | null;
  done_by: string | null;
  done_at: string | null;
  executed_as_role_id: string | null;
};
type Item = { id: string; label: string; setor: string; tipo: string };
type LogRow = {
  id: number;
  tipo: string;
  item_id: string;
  done: boolean;
  acao: string;
  changed_by: string | null;
  changed_at: string;
  executed_as_role_id: string | null;
};

const ACAO_STYLE: Record<string, string> = {
  concluiu: "bg-success/15 text-success",
  desmarcou: "bg-destructive/15 text-destructive",
  atualizou: "bg-muted text-muted-foreground",
};

const TIPO_LABEL: Record<string, string> = {
  abertura: "Abertura",
  meio: "Meio",
  fechamento: "Fechamento",
};

function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function AuditoriaPage() {
  const { user } = useAuth();
  const [dataSel, setDataSel] = useState(hojeISO());
  const [tipoSel, setTipoSel] = useState<string>("todos");
  const [soFeitas, setSoFeitas] = useState(true);
  const [modo, setModo] = useState<"atual" | "historico">("atual");

  const itensQ = useQuery({
    queryKey: ["db", "audit_itens"],
    queryFn: async (): Promise<Item[]> => {
      const { data, error } = await sb.from("checklist_itens").select("id, label, setor, tipo");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled: !!user,
  });
  const regsQ = useQuery({
    queryKey: ["db", "audit_regs", dataSel],
    queryFn: async (): Promise<Registro[]> => {
      const { data, error } = await sb
        .from("checklist_registros")
        .select("data, tipo, item_id, done, observacao, done_by, done_at, executed_as_role_id")
        .eq("data", dataSel);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled: !!user,
  });
  const profsQ = useQuery({
    queryKey: ["db", "audit_profs"],
    queryFn: async (): Promise<{ id: string; nome: string }[]> => {
      const { data, error } = await supabase.from("profiles").select("id, nome");
      if (error) throw new Error(error.message);
      return (data ?? []) as { id: string; nome: string }[];
    },
    enabled: !!user,
  });
  const rolesQ = useQuery({
    queryKey: ["db", "audit_roles"],
    queryFn: async (): Promise<{ id: string; nome: string }[]> => {
      const { data, error } = await sb.from("checklist_roles").select("id, nome");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled: !!user,
  });
  // Histórico de mudanças (item 9)
  const logQ = useQuery({
    queryKey: ["db", "audit_log", dataSel],
    queryFn: async (): Promise<LogRow[]> => {
      const { data, error } = await sb
        .from("checklist_registros_log")
        .select("id, tipo, item_id, done, acao, changed_by, changed_at, executed_as_role_id")
        .eq("data", dataSel)
        .order("changed_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled: !!user && modo === "historico",
  });

  const itemById = useMemo(() => {
    const m = new Map<string, Item>();
    for (const i of itensQ.data ?? []) m.set(i.id, i);
    return m;
  }, [itensQ.data]);
  const nomeById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of profsQ.data ?? []) m.set(p.id, p.nome);
    return m;
  }, [profsQ.data]);
  const roleById = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rolesQ.data ?? []) m.set(r.id, r.nome);
    return m;
  }, [rolesQ.data]);

  const linhas = useMemo(() => {
    let regs = regsQ.data ?? [];
    if (tipoSel !== "todos") regs = regs.filter((r) => r.tipo === tipoSel);
    if (soFeitas) regs = regs.filter((r) => r.done);
    return regs
      .map((r) => ({ r, item: itemById.get(r.item_id) }))
      .sort((a, b) => (b.r.done_at ?? "").localeCompare(a.r.done_at ?? ""));
  }, [regsQ.data, tipoSel, soFeitas, itemById]);

  const logLinhas = useMemo(() => {
    let logs = logQ.data ?? [];
    if (tipoSel !== "todos") logs = logs.filter((l) => l.tipo === tipoSel);
    return logs.map((l) => ({ l, item: itemById.get(l.item_id) }));
  }, [logQ.data, tipoSel, itemById]);

  if (!user) return null;
  const isStaff = user.role === "admin" || user.role === "gerente";
  if (!isStaff) return <Navigate to="/dashboard" />;

  const totalFeitas = (regsQ.data ?? []).filter((r) => r.done).length;
  const loading = itensQ.isLoading || regsQ.isLoading;

  return (
    <div className="space-y-4 pb-6">
      <div>
        <Link to="/dashboard" className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <ArrowLeft className="h-3 w-3" /> Início
        </Link>
        <h1 className="mt-2 font-display text-xl font-bold flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" /> Auditoria de Checklists
        </h1>
        <p className="text-xs text-muted-foreground">Quem fez, quando, por qual papel e o status.</p>
      </div>

      <Card>
        <CardContent className="space-y-3 p-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setModo("atual")}
              className={`flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-xs font-semibold transition ${
                modo === "atual" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5" /> Status atual
            </button>
            <button
              onClick={() => setModo("historico")}
              className={`flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-xs font-semibold transition ${
                modo === "historico" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
              }`}
            >
              <History className="h-3.5 w-3.5" /> Histórico
            </button>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Data</label>
              <Input type="date" value={dataSel} onChange={(e) => setDataSel(e.target.value)} />
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Concluídas</p>
              <p className="font-display text-xl font-bold">{totalFeitas}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {["todos", "abertura", "meio", "fechamento"].map((t) => (
              <button
                key={t}
                onClick={() => setTipoSel(t)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  tipoSel === t ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                }`}
              >
                {t === "todos" ? "Todos" : TIPO_LABEL[t]}
              </button>
            ))}
            <button
              onClick={() => setSoFeitas((v) => !v)}
              className={`ml-auto rounded-full border px-3 py-1 text-xs font-medium transition ${
                soFeitas ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
              }`}
            >
              {soFeitas ? "Só concluídas" : "Todas"}
            </button>
          </div>
        </CardContent>
      </Card>

      {modo === "atual" && (
        <>
      {loading && (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Carregando…</CardContent></Card>
      )}

      {!loading && linhas.length === 0 && (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
          Nenhum registro para esta data/filtro.
        </CardContent></Card>
      )}

      <div className="space-y-2">
        {linhas.map(({ r, item }) => {
          const quem = r.done_by ? nomeById.get(r.done_by) ?? "—" : "—";
          const papel = r.executed_as_role_id ? roleById.get(r.executed_as_role_id) ?? "—" : null;
          const hora = r.done_at
            ? new Date(r.done_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
            : null;
          return (
            <Card key={`${r.tipo}-${r.item_id}`}>
              <CardContent className="space-y-1 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{item?.label ?? r.item_id}</p>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      r.done ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
                    }`}
                  >
                    {r.done ? "Concluída" : "Pendente"}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {TIPO_LABEL[r.tipo] ?? r.tipo}{item?.setor ? ` · ${item.setor}` : ""}
                </p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  {r.done && (
                    <span className="inline-flex items-center gap-1 text-foreground/80">
                      <Check className="h-3 w-3 text-success" /> {quem}
                    </span>
                  )}
                  {hora && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {hora}
                    </span>
                  )}
                  {papel && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      {papel}
                    </span>
                  )}
                </div>
                {r.observacao && <p className="text-[11px] italic text-muted-foreground">{r.observacao}</p>}
              </CardContent>
            </Card>
          );
        })}
      </div>
        </>
      )}

      {modo === "historico" && (
        <>
          {logQ.isLoading && (
            <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Carregando…</CardContent></Card>
          )}
          {!logQ.isLoading && logLinhas.length === 0 && (
            <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
              Sem mudanças registradas nesta data.
            </CardContent></Card>
          )}
          <div className="space-y-2">
            {logLinhas.map(({ l, item }) => {
              const quem = l.changed_by ? nomeById.get(l.changed_by) ?? "—" : "—";
              const papel = l.executed_as_role_id ? roleById.get(l.executed_as_role_id) ?? null : null;
              const hora = new Date(l.changed_at).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              });
              return (
                <Card key={l.id}>
                  <CardContent className="space-y-1 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">{item?.label ?? l.item_id}</p>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          ACAO_STYLE[l.acao] ?? "bg-muted text-muted-foreground"
                        }`}
                      >
                        {l.acao}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {TIPO_LABEL[l.tipo] ?? l.tipo}{item?.setor ? ` · ${item.setor}` : ""}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1 text-foreground/80">
                        {l.acao === "desmarcou" ? (
                          <RotateCcw className="h-3 w-3 text-destructive" />
                        ) : (
                          <Check className="h-3 w-3 text-success" />
                        )}
                        {quem}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {hora}
                      </span>
                      {papel && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          {papel}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
