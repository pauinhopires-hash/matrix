// Phase 5 — Supabase data layer for checklists (setores, itens, registros).
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ChecklistTipo = Database["public"]["Enums"]["checklist_tipo"];
export type Setor = Database["public"]["Tables"]["setores"]["Row"];
export type ChecklistItem = Database["public"]["Tables"]["checklist_itens"]["Row"];
export type ChecklistRegistro =
  Database["public"]["Tables"]["checklist_registros"]["Row"];

export const TIPOS: ChecklistTipo[] = ["abertura", "meio", "fechamento"];

export const CHECKLIST_META: Record<
  ChecklistTipo,
  { titulo: string; descricao: string; icon: string }
> = {
  abertura: {
    titulo: "Abertura",
    descricao: "Início do turno — preparar a casa para abrir.",
    icon: "Sunrise",
  },
  meio: {
    titulo: "Meio do turno",
    descricao: "Manter a operação em ritmo durante o pico.",
    icon: "Sun",
  },
  fechamento: {
    titulo: "Fechamento",
    descricao: "Encerrar a operação e preparar o próximo dia.",
    icon: "Moon",
  },
};

export const qk = {
  setores: ["db", "setores"] as const,
  itens: (tipo: ChecklistTipo) => ["db", "checklist_itens", tipo] as const,
  itensAll: ["db", "checklist_itens"] as const,
  registros: (data: string) => ["db", "checklist_registros", data] as const,
};

export function todayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

// ---------- Setores ----------
export async function fetchSetores(): Promise<Setor[]> {
  const { data, error } = await supabase
    .from("setores")
    .select("*")
    .eq("ativo", true)
    .order("ordem")
    .order("nome");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function addSetor(nome: string, ordem = 0) {
  const { error } = await supabase.from("setores").insert({ nome, ordem });
  if (error) throw new Error(error.message);
}

export async function renameSetor(id: string, nome: string) {
  const { error } = await supabase.from("setores").update({ nome }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function removeSetor(id: string) {
  // Soft delete
  const { error } = await supabase.from("setores").update({ ativo: false }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function moveSetor(id: string, ordem: number) {
  const { error } = await supabase.from("setores").update({ ordem }).eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------- Itens ----------
export async function fetchItens(tipo?: ChecklistTipo): Promise<ChecklistItem[]> {
  let q = supabase.from("checklist_itens").select("*").eq("ativo", true);
  if (tipo) q = q.eq("tipo", tipo);
  const { data, error } = await q.order("setor").order("ordem").order("label");
  if (error) throw new Error(error.message);
  return data ?? [];
}

function genItemId(tipo: ChecklistTipo) {
  return `custom-${tipo}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export async function addItem(input: {
  tipo: ChecklistTipo;
  setor: string;
  label: string;
  ordem?: number;
}) {
  const { error } = await supabase.from("checklist_itens").insert({
    id: genItemId(input.tipo),
    tipo: input.tipo,
    setor: input.setor,
    label: input.label,
    ordem: input.ordem ?? 999,
  });
  if (error) throw new Error(error.message);
}

export async function updateItem(
  id: string,
  patch: Partial<Pick<ChecklistItem, "label" | "setor" | "tipo" | "ordem">>,
) {
  const { error } = await supabase.from("checklist_itens").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function removeItem(id: string) {
  // Soft delete
  const { error } = await supabase
    .from("checklist_itens")
    .update({ ativo: false })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function duplicateItem(item: ChecklistItem) {
  const { error } = await supabase.from("checklist_itens").insert({
    id: genItemId(item.tipo),
    tipo: item.tipo,
    setor: item.setor,
    label: `${item.label} (cópia)`,
    ordem: item.ordem + 1,
  });
  if (error) throw new Error(error.message);
}

export async function replicateItemToSetores(item: ChecklistItem, setores: string[]) {
  if (setores.length === 0) return;
  const rows = setores.map((s) => ({
    id: genItemId(item.tipo),
    tipo: item.tipo,
    setor: s,
    label: item.label,
    ordem: item.ordem,
  }));
  const { error } = await supabase.from("checklist_itens").insert(rows);
  if (error) throw new Error(error.message);
}

// ---------- Registros (estado diário) ----------
export async function fetchRegistros(data: string): Promise<ChecklistRegistro[]> {
  const { data: rows, error } = await supabase
    .from("checklist_registros")
    .select("*")
    .eq("data", data);
  if (error) throw new Error(error.message);
  return rows ?? [];
}

export interface RegistroUpsertInput {
  data: string;
  tipo: ChecklistTipo;
  item_id: string;
  done?: boolean;
  observacao?: string | null;
  foto_url?: string | null;
  user_id: string;
}

export async function upsertRegistro(input: RegistroUpsertInput) {
  // Try update first via composite match (data,tipo,item_id)
  const { data: existing, error: selErr } = await supabase
    .from("checklist_registros")
    .select("data, tipo, item_id")
    .eq("data", input.data)
    .eq("tipo", input.tipo)
    .eq("item_id", input.item_id)
    .maybeSingle();
  if (selErr) throw new Error(selErr.message);

  const patch: Partial<ChecklistRegistro> = {};
  if (input.done !== undefined) {
    patch.done = input.done;
    if (input.done) {
      patch.done_by = input.user_id;
      patch.done_at = new Date().toISOString();
    } else {
      patch.done_by = null;
      patch.done_at = null;
    }
  }
  if (input.observacao !== undefined) patch.observacao = input.observacao;
  if (input.foto_url !== undefined) patch.foto_url = input.foto_url;

  if (existing) {
    const { error } = await supabase
      .from("checklist_registros")
      .update(patch)
      .eq("data", input.data)
      .eq("tipo", input.tipo)
      .eq("item_id", input.item_id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("checklist_registros").insert({
      data: input.data,
      tipo: input.tipo,
      item_id: input.item_id,
      done: patch.done ?? false,
      done_by: patch.done_by ?? null,
      done_at: patch.done_at ?? null,
      observacao: patch.observacao ?? null,
      foto_url: patch.foto_url ?? null,
    });
    if (error) throw new Error(error.message);
  }
}

// ---------- Upload de foto ----------
export async function uploadChecklistFoto(file: File, userId: string): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from("checklist-fotos")
    .upload(path, file, { upsert: false, contentType: file.type || "image/jpeg" });
  if (error) throw new Error(error.message);
  return path; // store path; render via signed URL
}

export async function getChecklistFotoSignedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("checklist-fotos")
    .createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}

// ---------- Helpers de visualização ----------
export interface GroupedItens {
  setor: string;
  items: ChecklistItem[];
}

export function groupBySetor(items: ChecklistItem[]): GroupedItens[] {
  const map = new Map<string, ChecklistItem[]>();
  for (const it of items) {
    if (!map.has(it.setor)) map.set(it.setor, []);
    map.get(it.setor)!.push(it);
  }
  return Array.from(map.entries()).map(([setor, items]) => ({ setor, items }));
}

export function filterBySetor(
  items: ChecklistItem[],
  setor: string | null,
): ChecklistItem[] {
  if (!setor) return items;
  return items.filter((i) => i.setor === setor || i.setor === "Geral");
}
