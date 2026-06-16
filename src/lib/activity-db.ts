// Camada Supabase para activity_log.
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ActivityRow = Database["public"]["Tables"]["activity_log"]["Row"];
export type ActivityTipo = Database["public"]["Enums"]["activity_tipo"];

export const qk = {
  activity: (userId?: string) =>
    ["db", "activity_log", userId ?? "all"] as const,
};

export async function fetchActivity(userId?: string, limit = 50): Promise<ActivityRow[]> {
  let q = supabase
    .from("activity_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (userId) q = q.eq("user_id", userId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function logActivity(input: {
  tipo: ActivityTipo;
  nome: string;
  user_id?: string | null;
  detalhe?: string | null;
}) {
  const { error } = await supabase.from("activity_log").insert({
    tipo: input.tipo,
    nome: input.nome,
    user_id: input.user_id ?? null,
    detalhe: input.detalhe ?? null,
  });
  if (error) {
    // Não bloqueia o fluxo principal por falha de log
    console.warn("[activity_log]", error.message);
  }
}
