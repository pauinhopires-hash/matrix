export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          created_at: string
          detalhe: string | null
          id: string
          nome: string
          tipo: Database["public"]["Enums"]["activity_tipo"]
          user_id: string | null
        }
        Insert: {
          created_at?: string
          detalhe?: string | null
          id?: string
          nome: string
          tipo: Database["public"]["Enums"]["activity_tipo"]
          user_id?: string | null
        }
        Update: {
          created_at?: string
          detalhe?: string | null
          id?: string
          nome?: string
          tipo?: Database["public"]["Enums"]["activity_tipo"]
          user_id?: string | null
        }
        Relationships: []
      }
      categorias: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      checklist_itens: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          label: string
          ordem: number
          role_id: string | null
          setor: string
          tipo: Database["public"]["Enums"]["checklist_tipo"]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id: string
          label: string
          ordem?: number
          role_id?: string | null
          setor: string
          tipo: Database["public"]["Enums"]["checklist_tipo"]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          label?: string
          ordem?: number
          role_id?: string | null
          setor?: string
          tipo?: Database["public"]["Enums"]["checklist_tipo"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_itens_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "checklist_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_registros: {
        Row: {
          data: string
          done: boolean
          done_at: string | null
          done_by: string | null
          foto_url: string | null
          item_id: string
          observacao: string | null
          tipo: Database["public"]["Enums"]["checklist_tipo"]
          updated_at: string
        }
        Insert: {
          data: string
          done?: boolean
          done_at?: string | null
          done_by?: string | null
          foto_url?: string | null
          item_id: string
          observacao?: string | null
          tipo: Database["public"]["Enums"]["checklist_tipo"]
          updated_at?: string
        }
        Update: {
          data?: string
          done?: boolean
          done_at?: string | null
          done_by?: string | null
          foto_url?: string | null
          item_id?: string
          observacao?: string | null
          tipo?: Database["public"]["Enums"]["checklist_tipo"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_registros_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "checklist_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_role_users: {
        Row: {
          created_at: string
          id: string
          role_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_role_users_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "checklist_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_roles: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      locais: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          responsavel: Database["public"]["Enums"]["lider_tipo"] | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          responsavel?: Database["public"]["Enums"]["lider_tipo"] | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          responsavel?: Database["public"]["Enums"]["lider_tipo"] | null
        }
        Relationships: []
      }
      movimentos: {
        Row: {
          created_at: string
          foto_url: string | null
          id: string
          observacao: string | null
          produto_destino_id: string | null
          produto_id: string
          quantidade: number
          quantidade_destino: number | null
          sublocal_destino_id: string | null
          sublocal_origem_id: string | null
          tipo: Database["public"]["Enums"]["movimento_tipo"]
          user_id: string | null
        }
        Insert: {
          created_at?: string
          foto_url?: string | null
          id?: string
          observacao?: string | null
          produto_destino_id?: string | null
          produto_id: string
          quantidade: number
          quantidade_destino?: number | null
          sublocal_destino_id?: string | null
          sublocal_origem_id?: string | null
          tipo: Database["public"]["Enums"]["movimento_tipo"]
          user_id?: string | null
        }
        Update: {
          created_at?: string
          foto_url?: string | null
          id?: string
          observacao?: string | null
          produto_destino_id?: string | null
          produto_id?: string
          quantidade?: number
          quantidade_destino?: number | null
          sublocal_destino_id?: string | null
          sublocal_origem_id?: string | null
          tipo?: Database["public"]["Enums"]["movimento_tipo"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movimentos_produto_destino_id_fkey"
            columns: ["produto_destino_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentos_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentos_sublocal_destino_id_fkey"
            columns: ["sublocal_destino_id"]
            isOneToOne: false
            referencedRelation: "sublocais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentos_sublocal_origem_id_fkey"
            columns: ["sublocal_origem_id"]
            isOneToOne: false
            referencedRelation: "sublocais"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          ativo: boolean
          created_at: string
          default_sublocal_id: string | null
          estoque_minimo: number
          foto_url: string | null
          id: string
          nome: string
          role_id: string | null
          subcategoria_id: string | null
          unidade: string
          updated_at: string
          valor_unit: number | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          default_sublocal_id?: string | null
          estoque_minimo?: number
          foto_url?: string | null
          id?: string
          nome: string
          role_id?: string | null
          subcategoria_id?: string | null
          unidade?: string
          updated_at?: string
          valor_unit?: number | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          default_sublocal_id?: string | null
          estoque_minimo?: number
          foto_url?: string | null
          id?: string
          nome?: string
          role_id?: string | null
          subcategoria_id?: string | null
          unidade?: string
          updated_at?: string
          valor_unit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "produtos_default_sublocal_id_fkey"
            columns: ["default_sublocal_id"]
            isOneToOne: false
            referencedRelation: "sublocais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produtos_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "checklist_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produtos_subcategoria_id_fkey"
            columns: ["subcategoria_id"]
            isOneToOne: false
            referencedRelation: "subcategorias"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          cargo: string | null
          created_at: string
          email: string
          foto_url: string | null
          id: string
          nome: string
          setor: string | null
          status: Database["public"]["Enums"]["user_status"]
          updated_at: string
        }
        Insert: {
          cargo?: string | null
          created_at?: string
          email: string
          foto_url?: string | null
          id: string
          nome: string
          setor?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Update: {
          cargo?: string | null
          created_at?: string
          email?: string
          foto_url?: string | null
          id?: string
          nome?: string
          setor?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Relationships: []
      }
      requisicoes: {
        Row: {
          atendido_por: string | null
          created_at: string
          foto_url: string | null
          id: string
          observacao: string | null
          produto_id: string
          quantidade: number
          solicitante_id: string | null
          status: Database["public"]["Enums"]["requisicao_status"]
          sublocal_id: string | null
          updated_at: string
        }
        Insert: {
          atendido_por?: string | null
          created_at?: string
          foto_url?: string | null
          id?: string
          observacao?: string | null
          produto_id: string
          quantidade: number
          solicitante_id?: string | null
          status?: Database["public"]["Enums"]["requisicao_status"]
          sublocal_id?: string | null
          updated_at?: string
        }
        Update: {
          atendido_por?: string | null
          created_at?: string
          foto_url?: string | null
          id?: string
          observacao?: string | null
          produto_id?: string
          quantidade?: number
          solicitante_id?: string | null
          status?: Database["public"]["Enums"]["requisicao_status"]
          sublocal_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "requisicoes_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requisicoes_sublocal_id_fkey"
            columns: ["sublocal_id"]
            isOneToOne: false
            referencedRelation: "sublocais"
            referencedColumns: ["id"]
          },
        ]
      }
      saldos: {
        Row: {
          produto_id: string
          quantidade: number
          sublocal_id: string
          updated_at: string
        }
        Insert: {
          produto_id: string
          quantidade?: number
          sublocal_id: string
          updated_at?: string
        }
        Update: {
          produto_id?: string
          quantidade?: number
          sublocal_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "saldos_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saldos_sublocal_id_fkey"
            columns: ["sublocal_id"]
            isOneToOne: false
            referencedRelation: "sublocais"
            referencedColumns: ["id"]
          },
        ]
      }
      setores: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          ordem: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          ordem?: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
        }
        Relationships: []
      }
      subcategorias: {
        Row: {
          ativo: boolean
          categoria_id: string
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          categoria_id: string
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          categoria_id?: string
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "subcategorias_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      sublocais: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          lider: Database["public"]["Enums"]["lider_tipo"] | null
          local_id: string
          nome: string
          tipo: Database["public"]["Enums"]["sublocal_tipo"]
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          lider?: Database["public"]["Enums"]["lider_tipo"] | null
          local_id: string
          nome: string
          tipo?: Database["public"]["Enums"]["sublocal_tipo"]
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          lider?: Database["public"]["Enums"]["lider_tipo"] | null
          local_id?: string
          nome?: string
          tipo?: Database["public"]["Enums"]["sublocal_tipo"]
        }
        Relationships: [
          {
            foreignKeyName: "sublocais_local_id_fkey"
            columns: ["local_id"]
            isOneToOne: false
            referencedRelation: "locais"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      activity_tipo:
        | "login"
        | "logout"
        | "checklist_item"
        | "user_approved"
        | "user_rejected"
        | "signup"
      app_role: "admin" | "gerente" | "atendimento" | "cozinha" | "caixa"
      checklist_tipo: "abertura" | "meio" | "fechamento"
      lider_tipo:
        | "lider_cozinha"
        | "lider_caixa"
        | "lider_atendimento"
        | "lider_gerencia"
      movimento_tipo:
        | "entrada"
        | "retirada"
        | "porcionamento"
        | "ajuste"
        | "transferencia"
      requisicao_status: "pendente" | "atendida" | "recusada" | "cancelada"
      sublocal_tipo:
        | "geladeira"
        | "congelador"
        | "prateleira"
        | "filtro"
        | "outro"
      user_status: "pending" | "approved" | "rejected" | "active"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      activity_tipo: [
        "login",
        "logout",
        "checklist_item",
        "user_approved",
        "user_rejected",
        "signup",
      ],
      app_role: ["admin", "gerente", "atendimento", "cozinha", "caixa"],
      checklist_tipo: ["abertura", "meio", "fechamento"],
      lider_tipo: [
        "lider_cozinha",
        "lider_caixa",
        "lider_atendimento",
        "lider_gerencia",
      ],
      movimento_tipo: [
        "entrada",
        "retirada",
        "porcionamento",
        "ajuste",
        "transferencia",
      ],
      requisicao_status: ["pendente", "atendida", "recusada", "cancelada"],
      sublocal_tipo: [
        "geladeira",
        "congelador",
        "prateleira",
        "filtro",
        "outro",
      ],
      user_status: ["pending", "approved", "rejected", "active"],
    },
  },
} as const
