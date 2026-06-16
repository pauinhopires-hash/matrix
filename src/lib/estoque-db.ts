// Phase 2 — Supabase-backed data layer for Estoque (locais, categorias, produtos).
// Used by the new screens via @tanstack/react-query. RLS enforces who can write.
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Local = Database["public"]["Tables"]["locais"]["Row"];
export type SubLocal = Database["public"]["Tables"]["sublocais"]["Row"];
export type Categoria = Database["public"]["Tables"]["categorias"]["Row"];
export type Subcategoria = Database["public"]["Tables"]["subcategorias"]["Row"];
export type Produto = Database["public"]["Tables"]["produtos"]["Row"];

export type Lider = Database["public"]["Enums"]["lider_tipo"];
export type SubLocalTipo = Database["public"]["Enums"]["sublocal_tipo"];

export const LIDER_LABEL: Record<Lider, string> = {
  lider_cozinha: "Líder Cozinha",
  lider_caixa: "Líder Caixa",
  lider_atendimento: "Líder Atendimento",
  lider_gerencia: "Gerência",
};

export const LIDERES: Lider[] = [
  "lider_cozinha",
  "lider_caixa",
  "lider_atendimento",
  "lider_gerencia",
];
export const SUBLOCAL_TIPOS: SubLocalTipo[] = [
  "geladeira",
  "congelador",
  "prateleira",
  "filtro",
  "outro",
];
export const UNIDADES = ["kg", "g", "un", "L", "ml", "CX", "UND", "PCT", "GAL"];

export const qk = {
  locais: ["db", "locais"] as const,
  sublocais: ["db", "sublocais"] as const,
  categorias: ["db", "categorias"] as const,
  subcategorias: ["db", "subcategorias"] as const,
  produtos: ["db", "produtos"] as const,
};

function ok<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message);
  return data as T;
}

// ---------- Locais ----------
export async function fetchLocais(): Promise<Local[]> {
  const { data, error } = await supabase.from("locais").select("*").order("nome");
  return ok(data, error);
}
export async function upsertLocal(input: { id?: string; nome: string; responsavel: Lider | null }) {
  if (input.id) {
    const { error } = await supabase
      .from("locais")
      .update({ nome: input.nome, responsavel: input.responsavel })
      .eq("id", input.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("locais")
      .insert({ nome: input.nome, responsavel: input.responsavel });
    if (error) throw new Error(error.message);
  }
}
export async function deleteLocal(id: string) {
  const { error } = await supabase.from("locais").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------- Sublocais ----------
export async function fetchSublocais(): Promise<SubLocal[]> {
  const { data, error } = await supabase.from("sublocais").select("*").order("nome");
  return ok(data, error);
}
export async function upsertSublocal(input: {
  id?: string;
  nome: string;
  local_id: string;
  tipo: SubLocalTipo;
  lider: Lider | null;
}) {
  if (input.id) {
    const { error } = await supabase
      .from("sublocais")
      .update({ nome: input.nome, local_id: input.local_id, tipo: input.tipo, lider: input.lider })
      .eq("id", input.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("sublocais").insert({
      nome: input.nome,
      local_id: input.local_id,
      tipo: input.tipo,
      lider: input.lider,
    });
    if (error) throw new Error(error.message);
  }
}
export async function deleteSublocal(id: string) {
  const { error } = await supabase.from("sublocais").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------- Categorias ----------
export async function fetchCategorias(): Promise<Categoria[]> {
  const { data, error } = await supabase.from("categorias").select("*").order("nome");
  return ok(data, error);
}
export async function upsertCategoria(input: { id?: string; nome: string }) {
  if (input.id) {
    const { error } = await supabase.from("categorias").update({ nome: input.nome }).eq("id", input.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("categorias").insert({ nome: input.nome });
    if (error) throw new Error(error.message);
  }
}
export async function deleteCategoria(id: string) {
  const { error } = await supabase.from("categorias").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------- Subcategorias ----------
export async function fetchSubcategorias(): Promise<Subcategoria[]> {
  const { data, error } = await supabase.from("subcategorias").select("*").order("nome");
  return ok(data, error);
}
export async function upsertSubcategoria(input: { id?: string; nome: string; categoria_id: string }) {
  if (input.id) {
    const { error } = await supabase
      .from("subcategorias")
      .update({ nome: input.nome, categoria_id: input.categoria_id })
      .eq("id", input.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("subcategorias")
      .insert({ nome: input.nome, categoria_id: input.categoria_id });
    if (error) throw new Error(error.message);
  }
}
export async function deleteSubcategoria(id: string) {
  const { error } = await supabase.from("subcategorias").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------- Produtos ----------
export async function fetchProdutos(): Promise<Produto[]> {
  const { data, error } = await supabase.from("produtos").select("*").order("nome");
  return ok(data, error);
}
export async function upsertProduto(input: {
  id?: string;
  nome: string;
  unidade: string;
  subcategoria_id: string | null;
  default_sublocal_id: string | null;
  estoque_minimo: number;
  valor_unit: number | null;
  ativo: boolean;
}) {
  if (input.id) {
    const { error } = await supabase
      .from("produtos")
      .update({
        nome: input.nome,
        unidade: input.unidade,
        subcategoria_id: input.subcategoria_id,
        default_sublocal_id: input.default_sublocal_id,
        estoque_minimo: input.estoque_minimo,
        valor_unit: input.valor_unit,
        ativo: input.ativo,
      })
      .eq("id", input.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("produtos").insert({
      nome: input.nome,
      unidade: input.unidade,
      subcategoria_id: input.subcategoria_id,
      default_sublocal_id: input.default_sublocal_id,
      estoque_minimo: input.estoque_minimo,
      valor_unit: input.valor_unit,
      ativo: input.ativo,
    });
    if (error) throw new Error(error.message);
  }
}
export async function deleteProduto(id: string) {
  const { error } = await supabase.from("produtos").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
