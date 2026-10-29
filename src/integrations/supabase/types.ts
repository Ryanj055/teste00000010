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
      admin_events: {
        Row: {
          action: string
          actor: string | null
          created_at: string
          details: Json | null
          id: string
          organization_id: string | null
        }
        Insert: {
          action: string
          actor?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          organization_id?: string | null
        }
        Update: {
          action?: string
          actor?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      associates: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          organization_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          organization_id?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "associates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          entity: string
          entity_id: string
          id: string
          organization_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity: string
          entity_id: string
          id?: string
          organization_id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity?: string
          entity_id?: string
          id?: string
          organization_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      backup_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          error: string | null
          files: Json
          id: string
          kind: string
          organization_id: string
          requested_by: string | null
          requested_name: string
          row_count: number | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error?: string | null
          files?: Json
          id?: string
          kind?: string
          organization_id: string
          requested_by?: string | null
          requested_name?: string
          row_count?: number | null
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error?: string | null
          files?: Json
          id?: string
          kind?: string
          organization_id?: string
          requested_by?: string | null
          requested_name?: string
          row_count?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "backup_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          organization_id: string
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
          organization_id?: string
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
          organization_id?: string
          phone?: string | null
          responsible?: string
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          client_id: string
          close_note: string | null
          closed_at: string | null
          closed_by: string | null
          created_at: string
          demo: boolean
          expected_method: string | null
          id: string
          modality: string
          notes: string | null
          number: string
          organization_id: string
          responsible: string
          signed_at: string
          status: string
          subject: string
          total: number
        }
        Insert: {
          client_id: string
          close_note?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          demo?: boolean
          expected_method?: string | null
          id?: string
          modality?: string
          notes?: string | null
          number: string
          organization_id?: string
          responsible: string
          signed_at?: string
          status?: string
          subject: string
          total: number
        }
        Update: {
          client_id?: string
          close_note?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          demo?: boolean
          expected_method?: string | null
          id?: string
          modality?: string
          notes?: string | null
          number?: string
          organization_id?: string
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
          {
            foreignKeyName: "contracts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string
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
          organization_id?: string
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
          organization_id?: string
          paid_at?: string | null
          reimbursable?: boolean
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_divisions: {
        Row: {
          allocations: Json
          basis: string
          contract_id: string
          created_at: string
          id: string
          mode: string
          organization_id: string
          reason: string
          user_id: string | null
          version: number
        }
        Insert: {
          allocations: Json
          basis: string
          contract_id: string
          created_at?: string
          id?: string
          mode: string
          organization_id?: string
          reason: string
          user_id?: string | null
          version: number
        }
        Update: {
          allocations?: Json
          basis?: string
          contract_id?: string
          created_at?: string
          id?: string
          mode?: string
          organization_id?: string
          reason?: string
          user_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "fee_divisions_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_divisions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_payouts: {
        Row: {
          amount: number
          associate_id: string
          created_at: string
          division_id: string
          id: string
          idempotency_key: string
          method: string
          notes: string | null
          organization_id: string
          paid_at: string
          payment_id: string | null
          reference: string | null
          user_id: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          amount: number
          associate_id: string
          created_at?: string
          division_id: string
          id?: string
          idempotency_key: string
          method: string
          notes?: string | null
          organization_id?: string
          paid_at: string
          payment_id?: string | null
          reference?: string | null
          user_id?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          amount?: number
          associate_id?: string
          created_at?: string
          division_id?: string
          id?: string
          idempotency_key?: string
          method?: string
          notes?: string | null
          organization_id?: string
          paid_at?: string
          payment_id?: string | null
          reference?: string | null
          user_id?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fee_payouts_associate_id_fkey"
            columns: ["associate_id"]
            isOneToOne: false
            referencedRelation: "associates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_payouts_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "fee_divisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_payouts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_payouts_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_events: {
        Row: {
          action: string
          created_at: string
          details: Json
          entity_id: string
          id: string
          organization_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details: Json
          entity_id: string
          id?: string
          organization_id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json
          entity_id?: string
          id?: string
          organization_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      installments: {
        Row: {
          amount: number
          contract_id: string
          demo: boolean
          due_date: string
          id: string
          label: string
          organization_id: string
          original_amount: number | null
          superseded: boolean
        }
        Insert: {
          amount: number
          contract_id: string
          demo?: boolean
          due_date: string
          id?: string
          label: string
          organization_id?: string
          original_amount?: number | null
          superseded?: boolean
        }
        Update: {
          amount?: number
          contract_id?: string
          demo?: boolean
          due_date?: string
          id?: string
          label?: string
          organization_id?: string
          original_amount?: number | null
          superseded?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "installments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_cases: {
        Row: {
          client_id: string
          closed_at: string | null
          created_at: string
          deadline_note: string | null
          demo: boolean
          id: string
          legal_area: string | null
          next_deadline: string | null
          notes: string | null
          number: string
          organization_id: string
          responsible: string
          status: string
          subject: string
        }
        Insert: {
          client_id: string
          closed_at?: string | null
          created_at?: string
          deadline_note?: string | null
          demo?: boolean
          id?: string
          legal_area?: string | null
          next_deadline?: string | null
          notes?: string | null
          number: string
          organization_id?: string
          responsible: string
          status?: string
          subject: string
        }
        Update: {
          client_id?: string
          closed_at?: string | null
          created_at?: string
          deadline_note?: string | null
          demo?: boolean
          id?: string
          legal_area?: string | null
          next_deadline?: string | null
          notes?: string | null
          number?: string
          organization_id?: string
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
          {
            foreignKeyName: "legal_cases_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          active: boolean
          can_finance: boolean
          can_legal: boolean
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_general_admin: boolean
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          active?: boolean
          can_finance?: boolean
          can_legal?: boolean
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_general_admin?: boolean
          organization_id: string
          role?: string
          user_id: string
        }
        Update: {
          active?: boolean
          can_finance?: boolean
          can_legal?: boolean
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_general_admin?: boolean
          organization_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          ends_at: string | null
          id: string
          name: string
          plan: string
          starts_at: string | null
          status: string
          support_notes: string | null
          trial_ends_at: string | null
        }
        Insert: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          name: string
          plan?: string
          starts_at?: string | null
          status?: string
          support_notes?: string | null
          trial_ends_at?: string | null
        }
        Update: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          name?: string
          plan?: string
          starts_at?: string | null
          status?: string
          support_notes?: string | null
          trial_ends_at?: string | null
        }
        Relationships: []
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
          organization_id: string
          paid_at: string
          reference: string | null
          user_id: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
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
          organization_id?: string
          paid_at: string
          reference?: string | null
          user_id?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
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
          organization_id?: string
          paid_at?: string
          reference?: string | null
          user_id?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
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
          {
            foreignKeyName: "payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      rtg_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rtg_authorizations: {
        Row: {
          granted_at: string
          granted_by: string | null
          id: string
          organization_id: string
          revoked_at: string | null
          revoked_by: string | null
          rtg_email: string
          rtg_user_id: string
          scope: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          organization_id: string
          revoked_at?: string | null
          revoked_by?: string | null
          rtg_email: string
          rtg_user_id: string
          scope?: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          organization_id?: string
          revoked_at?: string | null
          revoked_by?: string | null
          rtg_email?: string
          rtg_user_id?: string
          scope?: string
        }
        Relationships: [
          {
            foreignKeyName: "rtg_authorizations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      payout_ledger: {
        Row: {
          amount: number | null
          division_id: string | null
          effective_date: string | null
          event_id: string | null
          organization_id: string | null
        }
        Relationships: []
      }
      receipt_ledger: {
        Row: {
          amount: number | null
          effective_date: string | null
          event_id: string | null
          installment_id: string | null
          kind: string | null
          organization_id: string | null
          payment_id: string | null
        }
        Relationships: []
      }
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
      backup_finish: {
        Args: {
          p_error: string
          p_files: Json
          p_id: string
          p_ok: boolean
          p_rows: number
        }
        Returns: undefined
      }
      backup_start: { Args: never; Returns: string }
      can_access: { Args: { p_org: string }; Returns: boolean }
      close_contract: {
        Args: { p_contract: string; p_note: string }
        Returns: undefined
      }
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
      create_contract_review: {
        Args: {
          p_client: string
          p_method: string
          p_modality: string
          p_notes: string
          p_number: string
          p_responsible: string
          p_schedule: Json
          p_signed: string
          p_subject: string
          p_total: number
        }
        Returns: string
      }
      current_org: { Args: never; Returns: string }
      has_finance: { Args: { p_org: string }; Returns: boolean }
      has_legal: { Args: { p_org: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_general_admin: { Args: never; Returns: boolean }
      is_org_admin: { Args: never; Returns: boolean }
      is_partner: { Args: never; Returns: boolean }
      is_rtg_admin: { Args: never; Returns: boolean }
      my_access: { Args: never; Returns: Json }
      office_grant_rtg: { Args: { p_email: string }; Returns: undefined }
      office_rename_member: {
        Args: { p_member: string; p_name: string }
        Returns: undefined
      }
      office_revoke_rtg: { Args: { p_id: string }; Returns: undefined }
      office_transfer_general_admin: {
        Args: { p_member: string }
        Returns: undefined
      }
      org_access_ok: { Args: { p_org: string }; Returns: boolean }
      record_fee_payout: {
        Args: {
          p_amount: number
          p_associate: string
          p_date: string
          p_division: string
          p_key: string
          p_method: string
          p_notes?: string
          p_payment?: string
          p_reference?: string
        }
        Returns: string
      }
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
      remove_client: {
        Args: { p_archive?: boolean; p_client: string }
        Returns: string
      }
      renegotiate_contract: {
        Args: { p_contract: string; p_reason: string; p_schedule: Json }
        Returns: number
      }
      rtg_authorized: {
        Args: { p_org: string; p_scope: string }
        Returns: boolean
      }
      rtg_save_org: {
        Args: {
          p_contact_email: string
          p_contact_name: string
          p_contact_phone: string
          p_end: string
          p_id: string
          p_name: string
          p_plan: string
          p_start: string
          p_status: string
          p_support: string
          p_trial: string
        }
        Returns: string
      }
      rtg_set_general_admin: {
        Args: { p_member: string; p_org: string }
        Returns: undefined
      }
      save_fee_division: {
        Args: {
          p_allocations: Json
          p_basis: string
          p_contract: string
          p_mode: string
          p_reason: string
        }
        Returns: string
      }
      set_member_access: {
        Args: {
          p_active: boolean
          p_finance: boolean
          p_legal: boolean
          p_member: string
        }
        Returns: undefined
      }
      set_member_status: {
        Args: { p_active: boolean; p_member: string; p_role: string }
        Returns: undefined
      }
      void_financial_entry: {
        Args: { p_id: string; p_kind: string; p_reason: string }
        Returns: undefined
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
