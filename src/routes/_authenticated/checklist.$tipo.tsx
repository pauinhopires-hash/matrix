import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useMemo, useState, type ChangeEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
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
  filterBySetor,
  todayKey,
  qk,
} from "@/lib/checklists-db";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Camera, Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";

const VALID: ChecklistTipo[] = ["abertura", "meio", "fechamento"];

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

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: qk.registros(data) });
  };

  const toggleMut = useMutation({
    mutationFn: (vars: { item_id: string; done: boolean }) =>
      upsertRegistro({ ...vars, data, tipo, user_id: user!.id }),
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
  const filtered = filterBySetor(itens, isStaff ? null : user.setor);
  const groups = useMemo(() => groupBySetor(filtered), [filtered]);

  const registroMap = useMemo(() => {
    const m = new Map<string, (typeof registros)[number]>();
    for (const r of registros) if (r.tipo === tipo) m.set(r.item_id, r);
    return m;
  }, [registros, tipo]);

  const total = filtered.length;
  const done = filtered.filter((i) => registroMap.get(i.id)?.done).length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  function onFile(item_id: string, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    fotoMut.mutate({ item_id, file });
  }

  const loading = itensQuery.isLoading || registrosQuery.isLoading;

  return (
    <div className="space-y-5">
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
            Sem itens deste checklist para o seu setor.
          </CardContent>
        </Card>
      )}

      {groups.map((group) => (
        <section key={group.setor} className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {group.setor}
          </h2>
          <div className="space-y-2">
            {group.items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                registro={registroMap.get(item.id)}
                onToggle={(v) => toggleMut.mutate({ item_id: item.id, done: v })}
                onObs={(v) => obsMut.mutate({ item_id: item.id, observacao: v })}
                onFile={(e) => onFile(item.id, e)}
                onRemoveFoto={() => fotoMut.mutate({ item_id: item.id, file: null })}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ItemCard({
  item,
  registro,
  onToggle,
  onObs,
  onFile,
  onRemoveFoto,
}: {
  item: { id: string; label: string };
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
