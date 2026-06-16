// Camada Supabase para requisições de estoque.
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Requisicao = Database["public"]["Tables"]["requisicoes"]["Row"];
export type RequisicaoStatus = Database["public"]["Enums"]["requisicao_status"];

export const qk = {
  requisicoes: ["db", "requisicoes"] as const,
};

export async function fetchRequisicoes(): Promise<Requisicao[]> {
  const { data, error } = await supabase
    .from("requisicoes")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export interface CriarRequisicaoInput {
  produto_id: string;
  quantidade: number;
  observacao?: string;
  foto?: File | null;
  sublocal_id?: string | null;
  user_id: string;
}

async function uploadFotoRequisicao(file: File, userId: string): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from("estoque-fotos")
    .upload(path, file, { upsert: false, contentType: file.type || "image/jpeg" });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from("estoque-fotos").getPublicUrl(path);
  return data.publicUrl;
}

export async function criarRequisicao(input: CriarRequisicaoInput) {
  let foto_url: string | null = null;
  if (input.foto) foto_url = await uploadFotoRequisicao(input.foto, input.user_id);
  const { error } = await supabase.from("requisicoes").insert({
    produto_id: input.produto_id,
    quantidade: input.quantidade,
    observacao: input.observacao || null,
    foto_url,
    sublocal_id: input.sublocal_id ?? null,
    solicitante_id: input.user_id,
  });
  if (error) throw new Error(error.message);
}

export async function decidirRequisicao(
  id: string,
  status: Exclude<RequisicaoStatus, "pendente">,
  atendidoPor: string,
) {
  const { error } = await supabase
    .from("requisicoes")
    .update({ status, atendido_por: atendidoPor })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
