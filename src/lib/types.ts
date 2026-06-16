// Tipos compartilhados de domínio. Substituem os antigos de src/lib/storage.ts.
export type Role = "admin" | "gerente" | "cozinha" | "atendimento" | "caixa";
export type Setor = string;
export type UserStatus = "pending" | "active" | "rejected";

export interface User {
  id: string;
  nome: string;
  email: string;
  cargo: string;
  setor: Setor;
  role: Role;
  fotoDataUrl?: string;
  status: UserStatus;
  createdAt: number;
}

export type ChecklistTipo = "abertura" | "meio" | "fechamento";
