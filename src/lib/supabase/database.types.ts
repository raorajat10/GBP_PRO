export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      client_users: {
        Row: {
          client_id: string;
          created_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          client_id: string;
          created_at?: string;
          user_id: string;
        };
        Update: {
          client_id?: string;
          created_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "client_users_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_users_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      clients: {
        Row: {
          assigned_manager_id: string | null;
          brand_notes: string | null;
          business_name: string;
          created_at: string;
          id: string;
          industry: string | null;
          owner_name: string | null;
          owner_whatsapp: string | null;
          preferred_language: string;
          status: string;
          updated_at: string;
          whatsapp_opt_in_at: string | null;
        };
        ComputedFields: never;
        Insert: {
          assigned_manager_id?: string | null;
          brand_notes?: string | null;
          business_name: string;
          created_at?: string;
          id?: string;
          industry?: string | null;
          owner_name?: string | null;
          owner_whatsapp?: string | null;
          preferred_language?: string;
          status?: string;
          updated_at?: string;
          whatsapp_opt_in_at?: string | null;
        };
        Update: {
          assigned_manager_id?: string | null;
          brand_notes?: string | null;
          business_name?: string;
          created_at?: string;
          id?: string;
          industry?: string | null;
          owner_name?: string | null;
          owner_whatsapp?: string | null;
          preferred_language?: string;
          status?: string;
          updated_at?: string;
          whatsapp_opt_in_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "clients_assigned_manager_id_fkey";
            columns: ["assigned_manager_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      gbp_connections: {
        Row: {
          client_id: string | null;
          connected_at: string;
          connected_by: string | null;
          google_account_label: string | null;
          google_account_name: string;
          id: string;
          last_error: string | null;
          mode: string;
          provider: string;
          refresh_token_encrypted: string | null;
          status: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          client_id?: string | null;
          connected_at?: string;
          connected_by?: string | null;
          google_account_label?: string | null;
          google_account_name: string;
          id?: string;
          last_error?: string | null;
          mode: string;
          provider: string;
          refresh_token_encrypted?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          client_id?: string | null;
          connected_at?: string;
          connected_by?: string | null;
          google_account_label?: string | null;
          google_account_name?: string;
          id?: string;
          last_error?: string | null;
          mode?: string;
          provider?: string;
          refresh_token_encrypted?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "gbp_connections_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "gbp_connections_connected_by_fkey";
            columns: ["connected_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      locations: {
        Row: {
          address: Json | null;
          client_id: string;
          connection_id: string;
          created_at: string;
          gbp_account_name: string;
          gbp_location_name: string;
          id: string;
          phone: string | null;
          place_id: string | null;
          primary_category: string | null;
          review_url: string | null;
          snapshot: NonNullable<Json>;
          synced_at: string;
          title: string;
          website: string | null;
        };
        ComputedFields: never;
        Insert: {
          address?: Json | null;
          client_id: string;
          connection_id: string;
          created_at?: string;
          gbp_account_name: string;
          gbp_location_name: string;
          id?: string;
          phone?: string | null;
          place_id?: string | null;
          primary_category?: string | null;
          review_url?: never;
          snapshot: NonNullable<Json>;
          synced_at?: string;
          title: string;
          website?: string | null;
        };
        Update: {
          address?: Json | null;
          client_id?: string;
          connection_id?: string;
          created_at?: string;
          gbp_account_name?: string;
          gbp_location_name?: string;
          id?: string;
          phone?: string | null;
          place_id?: string | null;
          primary_category?: string | null;
          review_url?: never;
          snapshot?: NonNullable<Json>;
          synced_at?: string;
          title?: string;
          website?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "locations_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "locations_connection_id_fkey";
            columns: ["connection_id"];
            isOneToOne: false;
            referencedRelation: "gbp_connections";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string;
          full_name: string | null;
          id: string;
          phone: string | null;
          role: Database["public"]["Enums"]["app_role"] | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          email: string;
          full_name?: string | null;
          id: string;
          phone?: string | null;
          role?: Database["public"]["Enums"]["app_role"] | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          full_name?: string | null;
          id?: string;
          phone?: string | null;
          role?: Database["public"]["Enums"]["app_role"] | null;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      app_role: "admin" | "manager" | "client";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "manager", "client"],
    },
  },
} as const;
