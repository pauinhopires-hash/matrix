// Phase 3 — Supabase movimentos + storage helpers.
// Trigger trg_aplicar_movimento updates the saldos table automatically.
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Movimento = Database["public"]["Tables"]["movimentos"]["Row"];
export type MovimentoTipo = Database["public"]["Enums"]["movimento_tipo"];
export type Saldo = Database["public"]["Tables"]["saldos"]["Row"];

export const qk = {
  saldos: ["db", "saldos"] as const,
  movimentos: ["db", "movimentos"] as const,
};

export async function uploadFotoMovimento(file: File, userId: string): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("estoque-fotos").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || "image/jpeg",
  });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from("estoque-fotos").getPublicUrl(path);
  return data.publicUrl;
}

export async function fetchSaldos(): Promise<Saldo[]> {
  const { data, error } = await supabase.from("saldos").select("*");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchSaldoProdutoSublocal(produto_id: string, sublocal_id: string): Promise<number> {
  const { data, error } = await supabase
    .from("saldos")
    .select("quantidade")
    .eq("produto_id", produto_id)
    .eq("sublocal_id", sublocal_id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Number(data?.quantidade ?? 0);
}

export async function fetchUltimosMovimentos(limit = 30): Promise<Movimento[]> {
  const { data, error } = await supabase
    .from("movimentos")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export interface RegistrarEntradaInput {
  produto_id: string;
  sublocal_destino_id: string;
  quantidade: number;
  observacao?: string;
  foto?: File | null;
  user_id: string;
}
export async function registrarEntrada(input: RegistrarEntradaInput) {
  let foto_url: string | null = null;
  if (input.foto) foto_url = await uploadFotoMovimento(input.foto, input.user_id);
  const { error } = await supabase.from("movimentos").insert({
    tipo: "entrada",
    produto_id: input.produto_id,
    sublocal_destino_id: input.sublocal_destino_id,
    quantidade: input.quantidade,
    observacao: input.observacao || null,
    foto_url,
    user_id: input.user_id,
  });
  if (error) throw new Error(error.message);
}

export interface RegistrarRetiradaInput {
  produto_id: string;
  sublocal_origem_id: string;
  quantidade: number;
  observacao?: string;
  foto: File;
  user_id: string;
}
export async function registrarRetirada(input: RegistrarRetiradaInput) {
  const foto_url = await uploadFotoMovimento(input.foto, input.user_id);
  const { error } = await supabase.from("movimentos").insert({
    tipo: "retirada",
    produto_id: input.produto_id,
    sublocal_origem_id: input.sublocal_origem_id,
    quantidade: input.quantidade,
    observacao: input.observacao || null,
    foto_url,
    user_id: input.user_id,
  });
  if (error) throw new Error(error.message);
}

export interface RegistrarPorcionamentoInput {
  produto_origem_id: string;
  sublocal_origem_id: string;
  quantidade_origem: number;
  produto_destino_id: string;
  sublocal_destino_id: string;
  quantidade_destino: number;
  observacao?: string;
  foto: File;
  user_id: string;
}
export async function registrarPorcionamento(input: RegistrarPorcionamentoInput) {
  const foto_url = await uploadFotoMovimento(input.foto, input.user_id);
  const { error } = await supabase.from("movimentos").insert({
    tipo: "porcionamento",
    produto_id: input.produto_origem_id,
    sublocal_origem_id: input.sublocal_origem_id,
    quantidade: input.quantidade_origem,
    produto_destino_id: input.produto_destino_id,
    sublocal_destino_id: input.sublocal_destino_id,
    quantidade_destino: input.quantidade_destino,
    observacao: input.observacao || null,
    foto_url,
    user_id: input.user_id,
  });
  if (error) throw new Error(error.message);
}

export interface AjusteBulkItem {
  produto_id: string;
  sublocal_id: string;
  quantidade: number;
}
export async function registrarAjusteBulk(items: AjusteBulkItem[], user_id: string, observacao = "Contagem inicial") {
  if (items.length === 0) return 0;
  const rows = items.map((it) => ({
    tipo: "ajuste" as const,
    produto_id: it.produto_id,
    sublocal_destino_id: it.sublocal_id,
    quantidade: it.quantidade,
    observacao,
    user_id,
  }));
  const { error } = await supabase.from("movimentos").insert(rows);
  if (error) throw new Error(error.message);
  return rows.length;
}

// Estorna um movimento criando o(s) movimento(s) inverso(s) — o gatilho de saldo
// se encarrega de corrigir o estoque. O original fica marcado como estornado.
export async function estornarMovimento(m: Movimento, user_id: string): Promise<void> {
  const mm = m as Movimento & {
    sublocal_origem_id: string | null;
    sublocal_destino_id: string | null;
    produto_destino_id: string | null;
    quantidade_destino: number | null;
    estornado_em: string | null;
  };
  if (mm.estornado_em) throw new Error("Este lançamento já foi estornado.");
  const quando = new Date(m.created_at).toLocaleString("pt-BR");
  const obs = `Estorno do lançamento de ${quando}`;
  const inserts: Record<string, unknown>[] = [];

  if (m.tipo === "entrada") {
    inserts.push({ tipo: "retirada", produto_id: m.produto_id, sublocal_origem_id: mm.sublocal_destino_id, quantidade: m.quantidade, observacao: obs, user_id, estorno_de: m.id });
  } else if (m.tipo === "retirada") {
    inserts.push({ tipo: "entrada", produto_id: m.produto_id, sublocal_destino_id: mm.sublocal_origem_id, quantidade: m.quantidade, observacao: obs, user_id, estorno_de: m.id });
  } else if (m.tipo === "porcionamento") {
    inserts.push({ tipo: "entrada", produto_id: m.produto_id, sublocal_destino_id: mm.sublocal_origem_id, quantidade: m.quantidade, observacao: obs, user_id, estorno_de: m.id });
    inserts.push({ tipo: "retirada", produto_id: mm.produto_destino_id, sublocal_origem_id: mm.sublocal_destino_id, quantidade: mm.quantidade_destino, observacao: obs, user_id, estorno_de: m.id });
  } else {
    throw new Error("Ajuste de contagem não pode ser estornado por aqui.");
  }

  const { error } = await supabase.from("movimentos").insert(inserts as never);
  if (error) throw new Error(error.message);
  const { error: e2 } = await supabase
    .from("movimentos")
    .update({ estornado_em: new Date().toISOString() } as never)
    .eq("id", m.id);
  if (e2) throw new Error(e2.message);
}

export function fmtQty(q: number, unidade: string): string {
  const n = Number(q);
  if (!Number.isFinite(n)) return `0 ${unidade}`;
  const rounded = Number.isInteger(n) ? n.toString() : n.toFixed(2).replace(/\.?0+$/, "");
  return `${rounded} ${unidade}`;
}
