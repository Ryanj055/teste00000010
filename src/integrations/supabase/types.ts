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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          created_at: string
          entity: string
          entity_id: string
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity: string
          entity_id: string
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity?: string
          entity_id?: string
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          address: string | null
          code: string
          created_at: string
          demo: boolean
          document: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          responsible: string
          status: string
          type: string
        }
        Insert: {
          address?: string | null
          code?: string
          created_at?: string
          demo?: boolean
          document?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          responsible?: string
          status?: string
          type?: string
        }
        Update: {
          address?: string | null
          code?: string
          created_at?: string
          demo?: boolean
          document?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          responsible?: string
          status?: string
          type?: string
        }
        Relationships: []
      }
      contracts: {
        Row: {
          client_id: string
          created_at: string
          demo: boolean
          id: string
          modality: string
          notes: string | null
          number: string
          responsible: string
          signed_at: string
          status: string
          subject: string
          total: number
        }
        Insert: {
          client_id: string
          created_at?: string
          demo?: boolean
          id?: string
          modality?: string
          notes?: string | null
          number: string
          responsible: string
          signed_at?: string
          status?: string
          subject: string
          total: number
        }
        Update: {
          client_id?: string
          created_at?: string
          demo?: boolean
          id?: string
          modality?: string
          notes?: string | null
          number?: string
          responsible?: string
          signed_at?: string
          status?: string
          subject?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          demo: boolean
          description: string
          due_date: string
          id: string
          paid_at: string | null
          reimbursable: boolean
          status: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          demo?: boolean
          description: string
          due_date: string
          id?: string
          paid_at?: string | null
          reimbursable?: boolean
          status?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          demo?: boolean
          description?: string
          due_date?: string
          id?: string
          paid_at?: string | null
          reimbursable?: boolean
          status?: string
        }
        Relationships: []
      }
      installments: {
        Row: {
          amount: number
          contract_id: string
          demo: boolean
          due_date: string
          id: string
          label: string
        }
        Insert: {
          amount: number
          contract_id: string
          demo?: boolean
          due_date: string
          id?: string
          label: string
        }
        Update: {
          amount?: number
          contract_id?: string
          demo?: boolean
          due_date?: string
          id?: string
          label?: string
        }
        Relationships: [
          {
            foreignKeyName: "installments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_cases: {
        Row: {
          client_id: string
          created_at: string
          deadline_note: string | null
          demo: boolean
          id: string
          next_deadline: string | null
          notes: string | null
          number: string
          responsible: string
          status: string
          subject: string
        }
        Insert: {
          client_id: string
          created_at?: string
          deadline_note?: string | null
          demo?: boolean
          id?: string
          next_deadline?: string | null
          notes?: string | null
          number: string
          responsible: string
          status?: string
          subject: string
        }
        Update: {
          client_id?: string
          created_at?: string
          deadline_note?: string | null
          demo?: boolean
          id?: string
          next_deadline?: string | null
          notes?: string | null
          number?: string
          responsible?: string
          status?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_cases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          demo: boolean
          id: string
          idempotency_key: string
          installment_id: string
          method: string
          notes: string | null
          paid_at: string
          reference: string | null
          user_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          demo?: boolean
          id?: string
          idempotency_key: string
          installment_id: string
          method: string
          notes?: string | null
          paid_at: string
          reference?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          demo?: boolean
          id?: string
          idempotency_key?: string
          installment_id?: string
          method?: string
          notes?: string | null
          paid_at?: string
          reference?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "receivables"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      receivables: {
        Row: {
          amount: number | null
          balance: number | null
          contract_id: string | null
          demo: boolean | null
          due_date: string | null
          id: string | null
          label: string | null
          last_payment: string | null
          paid: number | null
          status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "installments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      create_contract: {
        Args: {
          p_client: string
          p_modality: string
          p_notes?: string
          p_number: string
          p_responsible: string
          p_schedule: Json
          p_signed: string
          p_subject: string
          p_total: number
        }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_partner: { Args: never; Returns: boolean }
      record_payment: {
        Args: {
          p_amount: number
          p_date: string
          p_installment: string
          p_key: string
          p_method: string
          p_notes?: string
          p_reference?: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "partner"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "partner"],
    },
  },
} as const
