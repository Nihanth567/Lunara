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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      couple_members: {
        Row: {
          couple_id: string
          joined_at: string
          name: string
          user_id: string
        }
        Insert: {
          couple_id: string
          joined_at?: string
          name: string
          user_id: string
        }
        Update: {
          couple_id?: string
          joined_at?: string
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "couple_members_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
        ]
      }
      couples: {
        Row: {
          created_at: string
          current_streak: number
          id: string
          invite_code: string
          longest_streak: number
          member_count: number
          start_date: string
        }
        Insert: {
          created_at?: string
          current_streak?: number
          id?: string
          invite_code: string
          longest_streak?: number
          member_count?: number
          start_date?: string
        }
        Update: {
          created_at?: string
          current_streak?: number
          id?: string
          invite_code?: string
          longest_streak?: number
          member_count?: number
          start_date?: string
        }
        Relationships: []
      }
      entries: {
        Row: {
          couple_id: string
          cute: string
          date: string
          grateful: string
          grow: string
          grow_followup: string | null
          grow_followup_at: string | null
          reaction: string | null
          submitted: boolean
          updated_at: string
          user_id: string
          voice_cute: string | null
          voice_grateful: string | null
          voice_grow: string | null
        }
        Insert: {
          couple_id: string
          cute?: string
          date: string
          grateful?: string
          grow?: string
          grow_followup?: string | null
          grow_followup_at?: string | null
          reaction?: string | null
          submitted?: boolean
          updated_at?: string
          user_id: string
          voice_cute?: string | null
          voice_grateful?: string | null
          voice_grow?: string | null
        }
        Update: {
          couple_id?: string
          cute?: string
          date?: string
          grateful?: string
          grow?: string
          grow_followup?: string | null
          grow_followup_at?: string | null
          reaction?: string | null
          submitted?: boolean
          updated_at?: string
          user_id?: string
          voice_cute?: string | null
          voice_grateful?: string | null
          voice_grow?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entries_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
        ]
      }
      keepsakes: {
        Row: {
          answer: string
          couple_id: string
          question_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          answer?: string
          couple_id: string
          question_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          answer?: string
          couple_id?: string
          question_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "keepsakes_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          birthday: string | null
          created_at: string
          expo_push_token: string | null
          id: string
          is_subscribed: boolean
          name: string
          pronouns: string | null
          revenuecat_app_user_id: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          birthday?: string | null
          created_at?: string
          expo_push_token?: string | null
          id: string
          is_subscribed?: boolean
          name?: string
          pronouns?: string | null
          revenuecat_app_user_id?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          birthday?: string | null
          created_at?: string
          expo_push_token?: string | null
          id?: string
          is_subscribed?: boolean
          name?: string
          pronouns?: string | null
          revenuecat_app_user_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_couple: {
        Args: { p_user_name: string }
        Returns: {
          created_at: string
          current_streak: number
          id: string
          invite_code: string
          longest_streak: number
          member_count: number
          start_date: string
        }
        SetofOptions: {
          from: "*"
          to: "couples"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_my_couple: {
        Args: never
        Returns: {
          current_streak: number
          id: string
          invite_code: string
          is_subscribed: boolean
          longest_streak: number
          partner_name: string
          start_date: string
        }[]
      }
      join_couple: {
        Args: { p_invite_code: string; p_user_name: string }
        Returns: {
          created_at: string
          current_streak: number
          id: string
          invite_code: string
          longest_streak: number
          member_count: number
          start_date: string
        }
        SetofOptions: {
          from: "*"
          to: "couples"
          isOneToOne: true
          isSetofReturn: false
        }
      }
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
