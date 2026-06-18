// Camada Supabase para o módulo de Compras.
// Usa tabelas já existentes: fornecedores, requisicoes_compra, requisicao_compra_itens.
// Tipos são definidos localmente porque o types.ts gerado pode não cobrir estas tabelas.
import { supabase } from "@/integrations/supabase/client";

// O cliente é tipado pelo Database gerado e pode não conhecer estas tabelas.
// Usamos um cast frouxo para não quebrar o build de TS.
const db = supabase as unknown as {
  from: (table: string) => any;
};

export type RequisicaoCompraStatus =
  | "pendente"
  | "em_compra"
  | "comprada"
  | "recebida"
  | "cancelada";

export interface Fornecedor {
  id: string;
  nome: string;
  contato: string | null;
  telefone: string | null;
  email: string | null;
  observacao: string | null;
  ativo: boolean;
  created_at: string;
}

export interface RequisicaoCompra {
  id: string;
  usuario_id: string;
  fornecedor_id: string | null;
  status: RequisicaoCompraStatus;
  observacao: string | null;
  created_at: string;
  updated_at: string;
}

export interface RequisicaoCompraItem {
  id: string;
  requisicao_id: string;
  produto_id: string | null;
  nome_custom: string | null;
  quantidade: number;
  unidade: string | null;
  valor_unit: number | null;
  comprado: boolean;
  comprado_em: string | null;
  created_at: string;
}

export const qk = {
  fornecedores: ["db", "fornecedores"] as const,
  requisicoesCompra: ["db", "requisicoes_compra"] as const,
  itensCompra: ["db", "requisicao_compra_itens"] as const,
  itensDePedido: (id: string) => ["db", "requisicao_compra_itens", id] as const,
};

function ok<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message);
  return data as T;
}

// ---------- Fornecedores ----------
export async function fetchFornecedores(): Promise<Fornecedor[]> {
  const { data, error } = await db.from("fornecedores").select("*").order("nome");
  return ok(data, error);
}

export async function upsertFornecedor(input: {
  id?: string;
  nome: string;
  contato?: string | null;
  telefone?: string | null;
  email?: string | null;
  observacao?: string | null;
  ativo?: boolean;
}) {
  if (input.id) {
    const { error } = await db
      .from("fornecedores")
      .update({
        nome: input.nome,
        contato: input.contato ?? null,
        telefone: input.telefone ?? null,
        email: input.email ?? null,
        observacao: input.observacao ?? null,
        ativo: input.ativo ?? true,
      })
      .eq("id", input.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await db.from("fornecedores").insert({
      nome: input.nome,
      contato: input.contato ?? null,
      telefone: input.telefone ?? null,
      email: input.email ?? null,
      observacao: input.observacao ?? null,
      ativo: input.ativo ?? true,
    });
    if (error) throw new Error(error.message);
  }
}

export async function toggleFornecedorAtivo(id: string, ativo: boolean) {
  const { error } = await db.from("fornecedores").update({ ativo }).eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------- Requisições de Compra ----------
export async function fetchRequisicoesCompra(): Promise<RequisicaoCompra[]> {
  const { data, error } = await db
    .from("requisicoes_compra")
    .select("*")
    .order("created_at", { ascending: false });
  return ok(data, error);
}

export async function fetchItensCompra(): Promise<RequisicaoCompraItem[]> {
  const { data, error } = await db
    .from("requisicao_compra_itens")
    .select("*")
    .order("created_at", { ascending: true });
  return ok(data, error);
}

export interface NovoItemCompra {
  produto_id?: string | null;
  nome_custom?: string | null;
  quantidade: number;
  unidade?: string | null;
  valor_unit?: number | null;
}

export async function criarRequisicaoCompra(input: {
  usuario_id: string;
  fornecedor_id?: string | null;
  observacao?: string | null;
  itens: NovoItemCompra[];
}) {
  const { data, error } = await db
    .from("requisicoes_compra")
    .insert({
      usuario_id: input.usuario_id,
      fornecedor_id: input.fornecedor_id ?? null,
      observacao: input.observacao ?? null,
      status: "pendente" as RequisicaoCompraStatus,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const requisicaoId = (data as { id: string }).id;

  if (input.itens.length > 0) {
    const rows = input.itens.map((i) => ({
      requisicao_id: requisicaoId,
      produto_id: i.produto_id ?? null,
      nome_custom: i.nome_custom ?? null,
      quantidade: i.quantidade,
      unidade: i.unidade ?? null,
      valor_unit: i.valor_unit ?? null,
      comprado: false,
    }));
    const { error: e2 } = await db.from("requisicao_compra_itens").insert(rows);
    if (e2) throw new Error(e2.message);
  }
  return requisicaoId;
}

export async function atualizarStatusRequisicao(
  id: string,
  status: RequisicaoCompraStatus,
) {
  const { error } = await db.from("requisicoes_compra").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function marcarItemComprado(id: string, comprado: boolean) {
  const { error } = await db
    .from("requisicao_compra_itens")
    .update({ comprado, comprado_em: comprado ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
