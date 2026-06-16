// Executa o plano de importação direto no Supabase.
// Também hospeda os tipos (RawRow, ImportPlan, ImportSummary) e o builder
// buildImportPlan, antes em src/lib/estoque.ts.
import { supabase } from "@/integrations/supabase/client";

// ---------- Tipos ----------

export interface RawRow {
  produto: string;
  unidade: string;
  grupo: string;
  subgrupo: string;
  valorUnit?: number;
  setor: string;
  mapaInterno: string;
}

export interface ImportConflict {
  type: "grupo" | "subgrupo" | "sublocal";
  variantes: string[];
  sugestao: string;
  contexto?: string;
}

export interface ImportPlan {
  rows: RawRow[];
  conflicts: ImportConflict[];
  resolucoes: {
    grupos: Record<string, string>;
    subgrupos: Record<string, string>;
    sublocais: Record<string, string>;
  };
}

export interface ImportSummary {
  locaisCriados: number;
  sublocaisCriados: number;
  categoriasCriadas: number;
  subcategoriasCriadas: number;
  produtosCriados: number;
  produtosAtualizados: number;
}

type SubLocalTipo = "geladeira" | "congelador" | "prateleira" | "filtro" | "outro";
type LiderTipo = "lider_cozinha" | "lider_caixa" | "lider_atendimento" | "lider_gerencia";

// ---------- Helpers ----------

function norm(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function detectSubLocalNome(setor: string, mapa: string): {
  localNome: string;
  subNome: string;
  tipo: SubLocalTipo;
  lider: LiderTipo;
} {
  const m = norm(mapa);
  let tipo: SubLocalTipo = "outro";
  if (m.includes("congelador")) tipo = "congelador";
  else if (m.includes("geladeira")) tipo = "geladeira";
  else if (m.includes("prateleira")) tipo = "prateleira";
  else if (m.includes("filtro")) tipo = "filtro";

  const letra = m.match(/[\s-]([mjbf])\s*$/)?.[1];
  const lider: LiderTipo =
    letra === "j" || letra === "f"
      ? "lider_caixa"
      : letra === "b"
        ? "lider_atendimento"
        : "lider_cozinha";

  const setorNorm = norm(setor);
  const localNome = setorNorm.includes("cozinha")
    ? "Cozinha"
    : setorNorm.includes("frente")
      ? "Frente"
      : "Estoque Central";

  let subNome: string;
  if (tipo === "filtro") subNome = "Filtro";
  else {
    const tipoLabel =
      tipo === "geladeira"
        ? "Geladeira"
        : tipo === "congelador"
          ? "Congelador"
          : tipo === "prateleira"
            ? "Prateleira"
            : "Outro";
    const liderLabel =
      lider === "lider_cozinha"
        ? "Cozinha"
        : lider === "lider_caixa"
          ? "Caixa"
          : lider === "lider_atendimento"
            ? "Atendimento"
            : "Gerência";
    subNome = `${tipoLabel} – ${liderLabel}`;
  }

  return { localNome, subNome, tipo, lider };
}

// ---------- buildImportPlan ----------

export function buildImportPlan(rows: RawRow[]): ImportPlan {
  const grupoVariantes = new Map<string, Set<string>>();
  const subgrupoVariantes = new Map<string, Set<string>>();
  const sublocalVariantes = new Map<string, Set<string>>();

  for (const r of rows) {
    const ng = norm(r.grupo);
    if (!grupoVariantes.has(ng)) grupoVariantes.set(ng, new Set());
    grupoVariantes.get(ng)!.add(r.grupo.trim());

    const sgKey = `${ng}::${norm(r.subgrupo)}`;
    if (!subgrupoVariantes.has(sgKey)) subgrupoVariantes.set(sgKey, new Set());
    subgrupoVariantes.get(sgKey)!.add(r.subgrupo.trim());

    const slKey = `${norm(r.setor)}::${norm(r.mapaInterno)}`;
    if (!sublocalVariantes.has(slKey)) sublocalVariantes.set(slKey, new Set());
    sublocalVariantes.get(slKey)!.add(`${r.setor.trim()} / ${r.mapaInterno.trim()}`);
  }

  const conflicts: ImportConflict[] = [];
  const resolucoes: ImportPlan["resolucoes"] = { grupos: {}, subgrupos: {}, sublocais: {} };

  for (const [k, set] of grupoVariantes) {
    const arr = [...set];
    const canonical = arr[0].trim();
    resolucoes.grupos[k] = canonical;
    if (arr.length > 1) conflicts.push({ type: "grupo", variantes: arr, sugestao: canonical });
  }
  for (const [k, set] of subgrupoVariantes) {
    const arr = [...set];
    let canonical = arr[0].trim();
    if (/^mtp$/i.test(canonical)) canonical = "Matéria-Prima";
    resolucoes.subgrupos[k] = canonical;
    if (arr.length > 1)
      conflicts.push({
        type: "subgrupo",
        variantes: arr,
        sugestao: canonical,
        contexto: k.split("::")[0],
      });
  }
  for (const [k, set] of sublocalVariantes) {
    const arr = [...set];
    const [setor, mapa] = arr[0].split(" / ");
    const det = detectSubLocalNome(setor, mapa);
    resolucoes.sublocais[k] = `${det.localNome}::${det.subNome}`;
    if (arr.length > 1)
      conflicts.push({
        type: "sublocal",
        variantes: arr,
        sugestao: `${det.localNome} / ${det.subNome}`,
      });
  }

  return { rows, conflicts, resolucoes };
}

// ---------- Execução no Supabase ----------

function detectTipoLider(mapa: string): { tipo: SubLocalTipo; lider: LiderTipo } {
  const d = detectSubLocalNome("", mapa);
  return { tipo: d.tipo, lider: d.lider };
}

export async function executarImportacaoSupabase(plan: ImportPlan): Promise<ImportSummary> {
  const summary: ImportSummary = {
    locaisCriados: 0,
    sublocaisCriados: 0,
    categoriasCriadas: 0,
    subcategoriasCriadas: 0,
    produtosCriados: 0,
    produtosAtualizados: 0,
  };

  const [locaisRes, sublocaisRes, catRes, subcatRes, prodRes] = await Promise.all([
    supabase.from("locais").select("id, nome"),
    supabase.from("sublocais").select("id, nome, local_id"),
    supabase.from("categorias").select("id, nome"),
    supabase.from("subcategorias").select("id, nome, categoria_id"),
    supabase.from("produtos").select("id, nome"),
  ]);
  for (const r of [locaisRes, sublocaisRes, catRes, subcatRes, prodRes]) {
    if (r.error) throw r.error;
  }

  const localByNorm = new Map<string, string>(
    (locaisRes.data ?? []).map((l) => [norm(l.nome), l.id]),
  );
  const sublocalByNorm = new Map<string, string>(
    (sublocaisRes.data ?? []).map((s) => [`${s.local_id}::${norm(s.nome)}`, s.id]),
  );
  const catByNorm = new Map<string, string>(
    (catRes.data ?? []).map((c) => [norm(c.nome), c.id]),
  );
  const subcatByNorm = new Map<string, string>(
    (subcatRes.data ?? []).map((s) => [`${s.categoria_id}::${norm(s.nome)}`, s.id]),
  );
  const prodByNorm = new Map<string, { id: string }>(
    (prodRes.data ?? []).map((p) => [norm(p.nome), { id: p.id }]),
  );

  async function ensureLocal(nome: string): Promise<string> {
    const k = norm(nome);
    const existing = localByNorm.get(k);
    if (existing) return existing;
    const { data, error } = await supabase
      .from("locais")
      .insert({ nome })
      .select("id")
      .single();
    if (error) throw error;
    localByNorm.set(k, data.id);
    summary.locaisCriados++;
    return data.id;
  }

  async function ensureSublocal(
    localId: string,
    nome: string,
    tipo: SubLocalTipo,
    lider: LiderTipo,
  ): Promise<string> {
    const k = `${localId}::${norm(nome)}`;
    const existing = sublocalByNorm.get(k);
    if (existing) return existing;
    const { data, error } = await supabase
      .from("sublocais")
      .insert({ local_id: localId, nome, tipo, lider })
      .select("id")
      .single();
    if (error) throw error;
    sublocalByNorm.set(k, data.id);
    summary.sublocaisCriados++;
    return data.id;
  }

  async function ensureCategoria(nome: string): Promise<string> {
    const k = norm(nome);
    const existing = catByNorm.get(k);
    if (existing) return existing;
    const { data, error } = await supabase
      .from("categorias")
      .insert({ nome })
      .select("id")
      .single();
    if (error) throw error;
    catByNorm.set(k, data.id);
    summary.categoriasCriadas++;
    return data.id;
  }

  async function ensureSubcategoria(catId: string, nome: string): Promise<string> {
    const k = `${catId}::${norm(nome)}`;
    const existing = subcatByNorm.get(k);
    if (existing) return existing;
    const { data, error } = await supabase
      .from("subcategorias")
      .insert({ categoria_id: catId, nome })
      .select("id")
      .single();
    if (error) throw error;
    subcatByNorm.set(k, data.id);
    summary.subcategoriasCriadas++;
    return data.id;
  }

  const sublocalIdByRawKey = new Map<string, string>();
  for (const [rawKey, canonico] of Object.entries(plan.resolucoes.sublocais)) {
    const [localNome, subNome] = canonico.split("::");
    if (!localNome || !subNome) continue;
    const localId = await ensureLocal(localNome);
    const mapa = rawKey.split("::")[1] ?? "";
    const { tipo, lider } = detectTipoLider(mapa);
    const subId = await ensureSublocal(localId, subNome, tipo, lider);
    sublocalIdByRawKey.set(rawKey, subId);
  }

  const categoriaIdByNg = new Map<string, string>();
  for (const [ng, nome] of Object.entries(plan.resolucoes.grupos)) {
    const id = await ensureCategoria(nome);
    categoriaIdByNg.set(ng, id);
  }
  const subcategoriaIdBySgKey = new Map<string, string>();
  for (const [sgKey, nome] of Object.entries(plan.resolucoes.subgrupos)) {
    const [ng] = sgKey.split("::");
    const catId = categoriaIdByNg.get(ng);
    if (!catId) continue;
    const id = await ensureSubcategoria(catId, nome);
    subcategoriaIdBySgKey.set(sgKey, id);
  }

  for (const r of plan.rows) {
    const ng = norm(r.grupo);
    const sgKey = `${ng}::${norm(r.subgrupo)}`;
    const slKey = `${norm(r.setor)}::${norm(r.mapaInterno)}`;
    const subcategoriaId = subcategoriaIdBySgKey.get(sgKey) ?? null;
    const defaultSublocalId = sublocalIdByRawKey.get(slKey) ?? null;
    const unidade = (r.unidade || "un").trim();
    const valorUnit = r.valorUnit ?? null;

    const existing = prodByNorm.get(norm(r.produto));
    if (existing) {
      const { error } = await supabase
        .from("produtos")
        .update({
          unidade,
          valor_unit: valorUnit,
          subcategoria_id: subcategoriaId,
          default_sublocal_id: defaultSublocalId,
        })
        .eq("id", existing.id);
      if (error) throw error;
      summary.produtosAtualizados++;
    } else {
      const { data, error } = await supabase
        .from("produtos")
        .insert({
          nome: r.produto.trim(),
          unidade,
          valor_unit: valorUnit,
          subcategoria_id: subcategoriaId,
          default_sublocal_id: defaultSublocalId,
        })
        .select("id")
        .single();
      if (error) throw error;
      prodByNorm.set(norm(r.produto), { id: data.id });
      summary.produtosCriados++;
    }
  }

  return summary;
}
