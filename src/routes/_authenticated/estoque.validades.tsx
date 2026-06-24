import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { fetchSublocais, fetchLocais, qk as estoqueQk } from "@/lib/estoque-db";
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
import { ArrowLeft, CalendarClock, Plus, Check, Trash2, Send } from "lucide-react";
import { toast } from "sonner";

const sb = supabase as unknown as { from: (t: string) => any };
const NONE = "__none__";

export const Route = createFileRoute("/_authenticated/estoque/validades")({
  head: () => ({ meta: [{ title: "Validade — Estoque" }] }),
  component: ValidadesPage,
});

type Validade = {
  id: string;
  descricao: string;
  quantidade: number | null;
  unidade: string | null;
  validade: string;
  sublocal_id: string | null;
  baixado_em: string | null;
  created_at: string;
};

function diasAte(dateStr: string): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + "T00:00:00");
  return Math.round((d.getTime() - hoje.getTime()) / 86400000);
}

function statusDe(dias: number) {
  if (dias < 0) return { label: "Vencido", cls: "bg-destructive/15 text-destructive", border: "border-destructive/40" };
  if (dias <= 2) return { label: dias === 0 ? "Vence hoje" : `Vence em ${dias}d`, cls: "bg-destructive/15 text-destructive", border: "border-destructive/30" };
  if (dias <= 7) return { label: `Vence em ${dias}d`, cls: "bg-amber-500/15 text-amber-600", border: "border-amber-500/30" };
  return { label: `${dias}d`, cls: "bg-emerald-500/15 text-emerald-600", border: "border-border" };
}

function ValidadesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [novo, setNovo] = useState(false);
  const [descricao, setDescricao] = useState("");
  const [validade, setValidade] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [unidade, setUnidade] = useState("");
  const [sublocalId, setSublocalId] = useState<string>(NONE);

  const { data: itens = [] } = useQuery({
    queryKey: ["db", "validades"],
    queryFn: async (): Promise<Validade[]> => {
      const { data, error } = await sb
        .from("validades")
        .select("id, descricao, quantidade, unidade, validade, sublocal_id, baixado_em, created_at")
        .is("baixado_em", null)
        .order("validade", { ascending: true });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
  const { data: sublocais = [] } = useQuery({ queryKey: estoqueQk.sublocais, queryFn: fetchSublocais });
  const { data: locais = [] } = useQuery({ queryKey: estoqueQk.locais, queryFn: fetchLocais });

  const subLabel = (id: string | null) => {
    if (!id) return "";
    const s = sublocais.find((x) => x.id === id);
    if (!s) return "";
    const l = locais.find((x) => x.id === s.local_id);
    return `${l?.nome ? l.nome + " · " : ""}${s.nome}`;
  };

  const criar = useMutation({
    mutationFn: async () => {
      const { error } = await sb.from("validades").insert({
        descricao: descricao.trim(),
        validade,
        quantidade: quantidade ? Number(quantidade) : null,
        unidade: unidade.trim() || null,
        sublocal_id: sublocalId === NONE ? null : sublocalId,
        criado_por: user!.id,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["db", "validades"] });
      toast.success("Item adicionado");
      setNovo(false);
      setDescricao(""); setValidade(""); setQuantidade(""); setUnidade(""); setSublocalId(NONE);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const baixar = useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo: string }) => {
      const { error } = await sb
        .from("validades")
        .update({ baixado_em: new Date().toISOString(), baixa_motivo: motivo })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["db", "validades"] });
      toast.success("Item baixado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("validades").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["db", "validades"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const ordenados = useMemo(() => [...itens].sort((a, b) => a.validade.localeCompare(b.validade)), [itens]);

  if (!user) return null;
  const isStaff = user.role === "admin" || user.role === "gerente";

  function salvar() {
    if (!descricao.trim()) return toast.error("Descreva o item");
    if (!validade) return toast.error("Informe a validade");
    criar.mutate();
  }

  function enviarWhatsapp() {
    if (ordenados.length === 0) return toast.error("Nada para enviar.");
    const linhas: string[] = [`📅 Validade — ${new Date().toLocaleDateString("pt-BR")}`, ""];
    for (const v of ordenados) {
      const dias = diasAte(v.validade);
      const [y, m, d] = v.validade.split("-");
      void y;
      const tag = dias < 0 ? "VENCIDO" : dias === 0 ? "vence hoje" : `vence em ${dias}d`;
      linhas.push(`• ${v.descricao} — ${d}/${m} (${tag})`);
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(linhas.join("\n"))}`, "_blank");
  }

  return (
    <div className="space-y-4 pb-6">
      <div>
        <Link to="/estoque" className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <ArrowLeft className="h-3 w-3" /> Estoque
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <h1 className="flex items-center gap-2 font-display text-xl font-bold">
            <CalendarClock className="h-5 w-5 text-primary" /> Validade
          </h1>
          <Button size="sm" onClick={() => setNovo(true)}>
            <Plus className="mr-1 h-4 w-4" /> Novo
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Itens perecíveis e suas datas de vencimento.</p>
      </div>

      {ordenados.length > 0 && (
        <Button variant="outline" className="w-full" onClick={enviarWhatsapp}>
          <Send className="mr-2 h-4 w-4" /> Enviar no WhatsApp
        </Button>
      )}

      {ordenados.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Nenhum item de validade cadastrado.
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {ordenados.map((v) => {
          const dias = diasAte(v.validade);
          const st = statusDe(dias);
          const [y, m, d] = v.validade.split("-");
          return (
            <Card key={v.id} className={st.border}>
              <CardContent className="flex items-center gap-2 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{v.descricao}</p>
                  <p className="text-[10px] text-muted-foreground">
                    Vence {d}/{m}/{y}
                    {v.quantidade != null ? ` · ${v.quantidade} ${v.unidade ?? ""}` : ""}
                    {v.sublocal_id ? ` · ${subLabel(v.sublocal_id)}` : ""}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${st.cls}`}>
                  {st.label}
                </span>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8"
                  title="Dar baixa"
                  onClick={() => {
                    if (confirm(`Dar baixa em "${v.descricao}"? (saiu da lista de validade)`)) {
                      baixar.mutate({ id: v.id, motivo: dias < 0 ? "descartado" : "usado" });
                    }
                  }}
                >
                  <Check className="h-3.5 w-3.5" />
                </Button>
                {isStaff && (
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-8 w-8 text-destructive"
                    title="Excluir"
                    onClick={() => {
                      if (confirm("Excluir este registro?")) excluir.mutate(v.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={novo} onOpenChange={(o) => !o && setNovo(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo item de validade</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Item / descrição</label>
              <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Molho de tomate (lote 12)" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Validade</label>
              <Input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Quantidade (opcional)</label>
                <Input type="number" inputMode="decimal" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Unidade (opcional)</label>
                <Input value={unidade} onChange={(e) => setUnidade(e.target.value)} placeholder="un, kg..." />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Local (opcional)</label>
              <Select value={sublocalId} onValueChange={setSublocalId}>
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {sublocais.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {subLabel(s.id)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovo(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={criar.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
