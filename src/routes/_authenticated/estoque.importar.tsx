import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import * as XLSX from "xlsx";
import { useAuth } from "@/lib/auth";
import {
  buildImportPlan,
  executarImportacaoSupabase,
  type RawRow,
  type ImportPlan,
  type ImportSummary,
} from "@/lib/importar-db";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/estoque/importar")({
  head: () => ({ meta: [{ title: "Importar — Estoque" }] }),
  component: ImportarPage,
});

function ImportarPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [loading, setLoading] = useState(false);

  if (!user) return null;
  if (user.role !== "admin" && user.role !== "gerente") {
    return <p className="text-sm text-muted-foreground">Acesso restrito.</p>;
  }

  async function onFile(file: File) {
    setLoading(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheetName =
        wb.SheetNames.find((n) => n.toUpperCase().includes("MATRIZ")) ?? wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
      const fixed = json
        .map((r) => {
          const findKey = (re: RegExp) => Object.keys(r).find((k) => re.test(k));
          const kProduto = findKey(/^produto$/i);
          const kUnidade = findKey(/unidade|medida/i);
          const kGrupo = findKey(/^grupo$/i);
          const kSub = findKey(/^subgrupo$/i);
          const kValor = findKey(/valor/i);
          const kSetor = findKey(/setor/i);
          const kMapa = findKey(/mapa/i);
          if (!kProduto || !kGrupo) return null;
          const v = (k: string | undefined) => (k ? String(r[k] ?? "").trim() : "");
          return {
            produto: v(kProduto),
            unidade: v(kUnidade) || "un",
            grupo: v(kGrupo),
            subgrupo: v(kSub),
            valorUnit: Number(v(kValor).replace(",", ".")) || undefined,
            setor: v(kSetor),
            mapaInterno: v(kMapa),
          } as RawRow;
        })
        .filter((r): r is RawRow => !!r && !!r.produto);

      if (fixed.length === 0) {
        toast.error("Nenhuma linha válida encontrada");
        return;
      }
      const p = buildImportPlan(fixed);
      setPlan(p);
      setSummary(null);
      toast.success(`${fixed.length} linhas analisadas`);
    } catch (e) {
      toast.error("Falha ao ler planilha: " + (e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const qc = useQueryClient();
  async function executar() {
    if (!plan) return;
    if (!confirm(`Importar ${plan.rows.length} produtos? Saldo inicial será 0.`)) return;
    setLoading(true);
    try {
      const s = await executarImportacaoSupabase(plan);
      setSummary(s);
      qc.invalidateQueries();
      toast.success("Importação concluída");
    } catch (e) {
      toast.error("Falha na importação: " + (e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function atualizarResolucao(
    grupo: "grupos" | "subgrupos" | "sublocais",
    chave: string,
    novo: string,
  ) {
    if (!plan) return;
    setPlan({
      ...plan,
      resolucoes: {
        ...plan.resolucoes,
        [grupo]: { ...plan.resolucoes[grupo], [chave]: novo },
      },
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <Link to="/estoque" className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <ArrowLeft className="h-3 w-3" /> Estoque
        </Link>
        <h1 className="mt-2 font-display text-xl font-bold flex items-center gap-2">
          <Upload className="h-5 w-5" /> Importar planilha
        </h1>
        <p className="text-xs text-muted-foreground">
          Aceita o formato MATRIZ (Produto, Unidade, Grupo, Subgrupo, Valor, Setor, Mapa Interno).
        </p>
      </div>

      {!summary && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <label className="block">
              <span className="text-xs text-muted-foreground">Arquivo .xlsx</span>
              <Input
                type="file"
                accept=".xlsx,.xls"
                disabled={loading}
                onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
              />
            </label>
            {loading && <p className="text-xs text-muted-foreground">Lendo planilha...</p>}
          </CardContent>
        </Card>
      )}

      {plan && !summary && (
        <>
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-3 flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-primary" />
              <p className="text-sm">
                <strong>{plan.rows.length}</strong> produtos prontos para importar
              </p>
            </CardContent>
          </Card>

          {plan.conflicts.length > 0 ? (
            <Card className="border-warning/40 bg-warning/5">
              <CardContent className="space-y-3 p-3">
                <div className="flex items-center gap-2 text-warning-foreground">
                  <AlertTriangle className="h-4 w-4" />
                  <p className="text-sm font-semibold">
                    {plan.conflicts.length} conflito(s) detectado(s) — revise antes de importar
                  </p>
                </div>
                <div className="space-y-2">
                  {plan.conflicts.map((c, i) => {
                    const tipoLabel =
                      c.type === "grupo" ? "Categoria" : c.type === "subgrupo" ? "Subcategoria" : "Sub-local";
                    const grupo =
                      c.type === "grupo" ? "grupos" : c.type === "subgrupo" ? "subgrupos" : "sublocais";
                    const chave =
                      Object.keys(plan.resolucoes[grupo]).find(
                        (k) =>
                          plan.resolucoes[grupo][k] === c.sugestao ||
                          c.variantes.some((v) => k.includes(v.toLowerCase())),
                      ) ?? c.sugestao;
                    return (
                      <div key={i} className="rounded border border-border bg-card p-2 text-xs">
                        <p className="text-[10px] uppercase font-semibold text-muted-foreground">
                          {tipoLabel}
                        </p>
                        <p className="mt-0.5">
                          Variantes: <em>{c.variantes.join(", ")}</em>
                        </p>
                        <Input
                          className="mt-1 h-7 text-xs"
                          defaultValue={plan.resolucoes[grupo][chave] ?? c.sugestao}
                          onBlur={(e) =>
                            atualizarResolucao(
                              grupo as "grupos" | "subgrupos" | "sublocais",
                              chave,
                              e.target.value,
                            )
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-success/40 bg-success/5">
              <CardContent className="p-3 flex items-center gap-2 text-success">
                <CheckCircle2 className="h-4 w-4" />
                <p className="text-sm font-semibold">Sem conflitos — pronto para importar</p>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => setPlan(null)} disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={executar} disabled={loading}>
              {loading ? "Importando..." : "Executar importação"}
            </Button>
          </div>
        </>
      )}

      {summary && (
        <Card className="border-success/40 bg-success/5">
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center gap-2 text-success">
              <CheckCircle2 className="h-5 w-5" />
              <p className="text-sm font-semibold">Importação concluída</p>
            </div>
            <ul className="text-xs space-y-0.5">
              <li>• {summary.locaisCriados} local(is) criado(s)</li>
              <li>• {summary.sublocaisCriados} sub-local(is) criado(s)</li>
              <li>• {summary.categoriasCriadas} categoria(s) criada(s)</li>
              <li>• {summary.subcategoriasCriadas} subcategoria(s) criada(s)</li>
              <li>• {summary.produtosCriados} produto(s) novo(s)</li>
              <li>• {summary.produtosAtualizados} produto(s) atualizado(s)</li>
            </ul>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setPlan(null);
                  setSummary(null);
                }}
              >
                Importar outra
              </Button>
              <Button onClick={() => nav({ to: "/estoque/produtos" })}>Ver produtos</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
