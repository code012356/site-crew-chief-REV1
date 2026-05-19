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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      account_requests: {
        Row: {
          created_at: string
          display_name: string
          id: string
          labor_id: string
          reason: string
          role: string
          username: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          labor_id?: string
          reason?: string
          role: string
          username: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          labor_id?: string
          reason?: string
          role?: string
          username?: string
        }
        Relationships: []
      }
      accounts: {
        Row: {
          created_at: string
          display_name: string
          enabled: boolean
          id: string
          labor_id: string | null
          last_active_at: string | null
          linked_personnel_id: string | null
          password: string
          phone: string
          role: string
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          display_name: string
          enabled?: boolean
          id?: string
          labor_id?: string | null
          last_active_at?: string | null
          linked_personnel_id?: string | null
          password: string
          phone?: string
          role?: string
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string
          display_name?: string
          enabled?: boolean
          id?: string
          labor_id?: string | null
          last_active_at?: string | null
          linked_personnel_id?: string | null
          password?: string
          phone?: string
          role?: string
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      daily_logs: {
        Row: {
          created_at: string
          date: string
          deleted_at: string | null
          entries: Json
          equipment_usage: Json
          foreman_id: string
          foreman_name: string
          id: string
          review_comment: string | null
          revisions: Json | null
          status: string
        }
        Insert: {
          created_at?: string
          date: string
          deleted_at?: string | null
          entries?: Json
          equipment_usage?: Json
          foreman_id: string
          foreman_name: string
          id?: string
          review_comment?: string | null
          revisions?: Json | null
          status?: string
        }
        Update: {
          created_at?: string
          date?: string
          deleted_at?: string | null
          entries?: Json
          equipment_usage?: Json
          foreman_id?: string
          foreman_name?: string
          id?: string
          review_comment?: string | null
          revisions?: Json | null
          status?: string
        }
        Relationships: []
      }
      engineer_assignments: {
        Row: {
          engineer_id: string
          foreman_ids: Json
          id: string
        }
        Insert: {
          engineer_id: string
          foreman_ids?: Json
          id?: string
        }
        Update: {
          engineer_id?: string
          foreman_ids?: Json
          id?: string
        }
        Relationships: []
      }
      equipment: {
        Row: {
          created_at: string
          equipment_no: string | null
          id: string
          location: string | null
          model: string
          name: string
          status: string
        }
        Insert: {
          created_at?: string
          equipment_no?: string | null
          id?: string
          location?: string | null
          model?: string
          name: string
          status?: string
        }
        Update: {
          created_at?: string
          equipment_no?: string | null
          id?: string
          location?: string | null
          model?: string
          name?: string
          status?: string
        }
        Relationships: []
      }
      equipment_requests: {
        Row: {
          admin_comment: string | null
          created_at: string
          engineer_comment: string | null
          equipment_id: string | null
          equipment_name: string
          id: string
          reason: string
          request_type: string
          requester_id: string
          requester_name: string
          requester_role: string
          resolved_at: string | null
          status: string
        }
        Insert: {
          admin_comment?: string | null
          created_at?: string
          engineer_comment?: string | null
          equipment_id?: string | null
          equipment_name: string
          id?: string
          reason?: string
          request_type?: string
          requester_id: string
          requester_name: string
          requester_role?: string
          resolved_at?: string | null
          status?: string
        }
        Update: {
          admin_comment?: string | null
          created_at?: string
          engineer_comment?: string | null
          equipment_id?: string | null
          equipment_name?: string
          id?: string
          reason?: string
          request_type?: string
          requester_id?: string
          requester_name?: string
          requester_role?: string
          resolved_at?: string | null
          status?: string
        }
        Relationships: []
      }
      personnel: {
        Row: {
          actual_work: string | null
          assigned_to: string | null
          code_no: string | null
          created_at: string
          entry_affiliation: string | null
          exit_affiliation: string | null
          exit_date: string | null
          id: string
          join_date: string
          labor_id: string | null
          leave_count: number
          leave_date: string | null
          leave_records_2025: string | null
          leave_records_2026: string | null
          name: string
          nationality: string | null
          passport_no: string | null
          phone: string
          project_dept: string | null
          role: string
          seq_no: number | null
          specialty: string | null
          status: string
          visa_expiry_date: string | null
          work_line: string | null
        }
        Insert: {
          actual_work?: string | null
          assigned_to?: string | null
          code_no?: string | null
          created_at?: string
          entry_affiliation?: string | null
          exit_affiliation?: string | null
          exit_date?: string | null
          id?: string
          join_date?: string
          labor_id?: string | null
          leave_count?: number
          leave_date?: string | null
          leave_records_2025?: string | null
          leave_records_2026?: string | null
          name: string
          nationality?: string | null
          passport_no?: string | null
          phone?: string
          project_dept?: string | null
          role?: string
          seq_no?: number | null
          specialty?: string | null
          status?: string
          visa_expiry_date?: string | null
          work_line?: string | null
        }
        Update: {
          actual_work?: string | null
          assigned_to?: string | null
          code_no?: string | null
          created_at?: string
          entry_affiliation?: string | null
          exit_affiliation?: string | null
          exit_date?: string | null
          id?: string
          join_date?: string
          labor_id?: string | null
          leave_count?: number
          leave_date?: string | null
          leave_records_2025?: string | null
          leave_records_2026?: string | null
          name?: string
          nationality?: string | null
          passport_no?: string | null
          phone?: string
          project_dept?: string | null
          role?: string
          seq_no?: number | null
          specialty?: string | null
          status?: string
          visa_expiry_date?: string | null
          work_line?: string | null
        }
        Relationships: []
      }
      team_assignments: {
        Row: {
          equipment_ids: Json
          foreman_id: string
          id: string
          worker_ids: Json
        }
        Insert: {
          equipment_ids?: Json
          foreman_id: string
          id?: string
          worker_ids?: Json
        }
        Update: {
          equipment_ids?: Json
          foreman_id?: string
          id?: string
          worker_ids?: Json
        }
        Relationships: []
      }
      work_codes: {
        Row: {
          area: string | null
          category: string
          code: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          area?: string | null
          category?: string
          code: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          area?: string | null
          category?: string
          code?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
