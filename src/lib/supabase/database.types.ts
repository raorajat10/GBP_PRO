export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      approvals: {
        Row: {
          channel: string;
          client_id: string;
          created_at: string;
          expires_at: string;
          id: string;
          reminded_at: string | null;
          responded_at: string | null;
          responded_via: string | null;
          response_note: string | null;
          sent_by: string | null;
          status: string;
          subject_id: string;
          subject_type: string;
          token_hash: string;
          wa_message_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          channel: string;
          client_id: string;
          created_at?: string;
          expires_at: string;
          id?: string;
          reminded_at?: string | null;
          responded_at?: string | null;
          responded_via?: string | null;
          response_note?: string | null;
          sent_by?: string | null;
          status?: string;
          subject_id: string;
          subject_type?: string;
          token_hash: string;
          wa_message_id?: string | null;
        };
        Update: {
          channel?: string;
          client_id?: string;
          created_at?: string;
          expires_at?: string;
          id?: string;
          reminded_at?: string | null;
          responded_at?: string | null;
          responded_via?: string | null;
          response_note?: string | null;
          sent_by?: string | null;
          status?: string;
          subject_id?: string;
          subject_type?: string;
          token_hash?: string;
          wa_message_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "approvals_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "approvals_sent_by_fkey";
            columns: ["sent_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "approvals_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_items: {
        Row: {
          audit_id: string;
          check_key: string;
          facts: string;
          fix_source: string;
          fix_text: string;
          id: string;
          points: number;
          points_lost: number | null;
          points_max: number;
          rank: number;
          status: string;
          title: string;
        };
        ComputedFields: never;
        Insert: {
          audit_id: string;
          check_key: string;
          facts: string;
          fix_source?: string;
          fix_text?: string;
          id?: string;
          points: number;
          points_lost?: never;
          points_max: number;
          rank: number;
          status: string;
          title: string;
        };
        Update: {
          audit_id?: string;
          check_key?: string;
          facts?: string;
          fix_source?: string;
          fix_text?: string;
          id?: string;
          points?: number;
          points_lost?: never;
          points_max?: number;
          rank?: number;
          status?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_items_audit_id_fkey";
            columns: ["audit_id"];
            isOneToOne: false;
            referencedRelation: "audits";
            referencedColumns: ["id"];
          },
        ];
      };
      audits: {
        Row: {
          ai_model: string | null;
          ai_worded_at: string | null;
          client_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          location_id: string;
          score: number;
          snapshot_synced_at: string;
          suggested_description: string | null;
        };
        ComputedFields: never;
        Insert: {
          ai_model?: string | null;
          ai_worded_at?: string | null;
          client_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          location_id: string;
          score: number;
          snapshot_synced_at: string;
          suggested_description?: string | null;
        };
        Update: {
          ai_model?: string | null;
          ai_worded_at?: string | null;
          client_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          location_id?: string;
          score?: number;
          snapshot_synced_at?: string;
          suggested_description?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audits_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audits_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audits_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
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
          rank_points_per_month: number;
          assigned_manager_id: string | null;
          brand_notes: string | null;
          business_name: string;
          created_at: string;
          google_review_link: string | null;
          reply_link: string | null;
          id: string;
          industry: string | null;
          owner_name: string | null;
          owner_whatsapp: string | null;
          preferred_language: string;
          slug: string;
          status: string;
          updated_at: string;
          whatsapp_opt_in_at: string | null;
        };
        ComputedFields: never;
        Insert: {
          rank_points_per_month?: number;
          assigned_manager_id?: string | null;
          brand_notes?: string | null;
          business_name: string;
          created_at?: string;
          google_review_link?: string | null;
          reply_link?: string | null;
          id?: string;
          industry?: string | null;
          owner_name?: string | null;
          owner_whatsapp?: string | null;
          preferred_language?: string;
          slug?: string;
          status?: string;
          updated_at?: string;
          whatsapp_opt_in_at?: string | null;
        };
        Update: {
          rank_points_per_month?: number;
          assigned_manager_id?: string | null;
          brand_notes?: string | null;
          business_name?: string;
          created_at?: string;
          google_review_link?: string | null;
          reply_link?: string | null;
          id?: string;
          industry?: string | null;
          owner_name?: string | null;
          owner_whatsapp?: string | null;
          preferred_language?: string;
          slug?: string;
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
      connect_invites: {
        Row: {
          client_id: string;
          connection_id: string | null;
          created_at: string;
          created_by: string | null;
          email_status: string;
          expires_at: string;
          id: string;
          sent_to_email: string | null;
          status: string;
          token_hash: string;
          used_at: string | null;
        };
        ComputedFields: never;
        Insert: {
          client_id: string;
          connection_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          email_status?: string;
          expires_at: string;
          id?: string;
          sent_to_email?: string | null;
          status?: string;
          token_hash: string;
          used_at?: string | null;
        };
        Update: {
          client_id?: string;
          connection_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          email_status?: string;
          expires_at?: string;
          id?: string;
          sent_to_email?: string | null;
          status?: string;
          token_hash?: string;
          used_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "connect_invites_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "connect_invites_connection_id_fkey";
            columns: ["connection_id"];
            isOneToOne: false;
            referencedRelation: "gbp_connections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "connect_invites_created_by_fkey";
            columns: ["created_by"];
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
          audit_score: number | null;
          audited_at: string | null;
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
          audit_score?: number | null;
          audited_at?: string | null;
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
          audit_score?: number | null;
          audited_at?: string | null;
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
      media_assets: {
        Row: {
          bytes: number;
          client_id: string;
          created_at: string;
          height: number;
          id: string;
          mime: string;
          storage_path: string;
          uploaded_by: string | null;
          width: number;
        };
        ComputedFields: never;
        Insert: {
          bytes: number;
          client_id: string;
          created_at?: string;
          height: number;
          id?: string;
          mime: string;
          storage_path: string;
          uploaded_by?: string | null;
          width: number;
        };
        Update: {
          bytes?: number;
          client_id?: string;
          created_at?: string;
          height?: number;
          id?: string;
          mime?: string;
          storage_path?: string;
          uploaded_by?: string | null;
          width?: number;
        };
        Relationships: [
          {
            foreignKeyName: "media_assets_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "media_assets_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          body: string | null;
          client_id: string | null;
          created_at: string;
          direction: string;
          error: string | null;
          from_number: string | null;
          id: string;
          payload: Json;
          provider: string;
          provider_message_id: string | null;
          status: string;
          template_name: string | null;
          to_number: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          body?: string | null;
          client_id?: string | null;
          created_at?: string;
          direction: string;
          error?: string | null;
          from_number?: string | null;
          id?: string;
          payload?: Json;
          provider: string;
          provider_message_id?: string | null;
          status?: string;
          template_name?: string | null;
          to_number?: string | null;
          updated_at?: string;
        };
        Update: {
          body?: string | null;
          client_id?: string | null;
          created_at?: string;
          direction?: string;
          error?: string | null;
          from_number?: string | null;
          id?: string;
          payload?: Json;
          provider?: string;
          provider_message_id?: string | null;
          status?: string;
          template_name?: string | null;
          to_number?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      posts: {
        Row: {
          ai_drafts: Json;
          ai_model: string | null;
          body: string;
          client_id: string;
          created_at: string;
          created_by: string | null;
          cta_type: string | null;
          cta_url: string | null;
          error: string | null;
          gbp_post_name: string | null;
          id: string;
          language: string;
          location_id: string | null;
          media_asset_id: string | null;
          published_at: string | null;
          scheduled_for: string | null;
          source_note: string;
          status: string;
          topic_type: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          ai_drafts?: Json;
          ai_model?: string | null;
          body?: string;
          client_id: string;
          created_at?: string;
          created_by?: string | null;
          cta_type?: string | null;
          cta_url?: string | null;
          error?: string | null;
          gbp_post_name?: string | null;
          id?: string;
          language: string;
          location_id?: string | null;
          media_asset_id?: string | null;
          published_at?: string | null;
          scheduled_for?: string | null;
          source_note: string;
          status?: string;
          topic_type?: string;
          updated_at?: string;
        };
        Update: {
          ai_drafts?: Json;
          ai_model?: string | null;
          body?: string;
          client_id?: string;
          created_at?: string;
          created_by?: string | null;
          cta_type?: string | null;
          cta_url?: string | null;
          error?: string | null;
          gbp_post_name?: string | null;
          id?: string;
          language?: string;
          location_id?: string | null;
          media_asset_id?: string | null;
          published_at?: string | null;
          scheduled_for?: string | null;
          source_note?: string;
          status?: string;
          topic_type?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "posts_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "posts_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "posts_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "posts_media_asset_id_fkey";
            columns: ["media_asset_id"];
            isOneToOne: false;
            referencedRelation: "media_assets";
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
          notify_email: boolean;
          notify_whatsapp: boolean;
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
          notify_email?: boolean;
          notify_whatsapp?: boolean;
          phone?: string | null;
          role?: Database["public"]["Enums"]["app_role"] | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          full_name?: string | null;
          id?: string;
          notify_email?: boolean;
          notify_whatsapp?: boolean;
          phone?: string | null;
          role?: Database["public"]["Enums"]["app_role"] | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      review_feedback: {
        Row: {
          client_id: string;
          contact: string | null;
          created_at: string;
          id: string;
          message: string;
          rating: number | null;
          status: string;
        };
        ComputedFields: never;
        Insert: {
          client_id: string;
          contact?: string | null;
          created_at?: string;
          id?: string;
          message: string;
          rating?: number | null;
          status?: string;
        };
        Update: {
          client_id?: string;
          contact?: string | null;
          created_at?: string;
          id?: string;
          message?: string;
          rating?: number | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "review_feedback_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      card_events: {
        Row: {
          client_id: string;
          created_at: string;
          id: number;
          kind: string;
        };
        ComputedFields: never;
        Insert: {
          client_id: string;
          created_at?: string;
          id?: never;
          kind: string;
        };
        Update: {
          client_id?: string;
          created_at?: string;
          id?: never;
          kind?: string;
        };
        Relationships: [
          {
            foreignKeyName: "card_events_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      change_requests: {
        Row: {
          area: string;
          client_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          message: string;
          resolved_at: string | null;
          status: string;
        };
        ComputedFields: never;
        Insert: {
          area: string;
          client_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          message: string;
          resolved_at?: string | null;
          status?: string;
        };
        Update: {
          area?: string;
          client_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          message?: string;
          resolved_at?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "change_requests_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "change_requests_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      location_metrics_daily: {
        Row: {
          calls: number;
          client_id: string;
          day: string;
          direction_requests: number;
          impressions_maps: number;
          impressions_search: number;
          location_id: string;
          website_clicks: number;
        };
        ComputedFields: never;
        Insert: {
          calls?: number;
          client_id: string;
          day: string;
          direction_requests?: number;
          impressions_maps?: number;
          impressions_search?: number;
          location_id: string;
          website_clicks?: number;
        };
        Update: {
          calls?: number;
          client_id?: string;
          day?: string;
          direction_requests?: number;
          impressions_maps?: number;
          impressions_search?: number;
          location_id?: string;
          website_clicks?: number;
        };
        Relationships: [
          {
            foreignKeyName: "location_metrics_daily_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "location_metrics_daily_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          body: string;
          client_id: string;
          created_at: string;
          id: string;
          kind: string;
          link: string | null;
          read_at: string | null;
          title: string;
        };
        ComputedFields: never;
        Insert: {
          body?: string;
          client_id: string;
          created_at?: string;
          id?: string;
          kind: string;
          link?: string | null;
          read_at?: string | null;
          title: string;
        };
        Update: {
          body?: string;
          client_id?: string;
          created_at?: string;
          id?: string;
          kind?: string;
          link?: string | null;
          read_at?: string | null;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      post_bank_items: {
        Row: {
          caption: string;
          client_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          media_asset_id: string;
          status: string;
          wanted_on: string | null;
        };
        ComputedFields: never;
        Insert: {
          caption?: string;
          client_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          media_asset_id: string;
          status?: string;
          wanted_on?: string | null;
        };
        Update: {
          caption?: string;
          client_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          media_asset_id?: string;
          status?: string;
          wanted_on?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "post_bank_items_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "post_bank_items_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "post_bank_items_media_asset_id_fkey";
            columns: ["media_asset_id"];
            isOneToOne: false;
            referencedRelation: "media_assets";
            referencedColumns: ["id"];
          },
        ];
      };
      reviews: {
        Row: {
          client_id: string;
          comment: string | null;
          gbp_review_name: string;
          id: string;
          location_id: string;
          replied_at: string | null;
          reply_comment: string | null;
          reviewed_at: string;
          reviewer: string;
          star_rating: number;
          synced_at: string;
        };
        ComputedFields: never;
        Insert: {
          client_id: string;
          comment?: string | null;
          gbp_review_name: string;
          id?: string;
          location_id: string;
          replied_at?: string | null;
          reply_comment?: string | null;
          reviewed_at: string;
          reviewer: string;
          star_rating: number;
          synced_at?: string;
        };
        Update: {
          client_id?: string;
          comment?: string | null;
          gbp_review_name?: string;
          id?: string;
          location_id?: string;
          replied_at?: string | null;
          reply_comment?: string | null;
          reviewed_at?: string;
          reviewer?: string;
          star_rating?: number;
          synced_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      support_tickets: {
        Row: {
          category: string;
          client_id: string;
          created_at: string;
          created_by: string | null;
          description: string;
          id: string;
          priority: string;
          status: string;
          subject: string;
          team_reply: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          category: string;
          client_id: string;
          created_at?: string;
          created_by?: string | null;
          description: string;
          id?: string;
          priority?: string;
          status?: string;
          subject: string;
          team_reply?: string | null;
          updated_at?: string;
        };
        Update: {
          category?: string;
          client_id?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string;
          id?: string;
          priority?: string;
          status?: string;
          subject?: string;
          team_reply?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "support_tickets_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "support_tickets_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      rank_keywords: {
        Row: {
          client_id: string;
          created_at: string;
          created_by: string | null;
          grid_size: number;
          id: string;
          keyword: string;
          location_id: string;
          radius_km: number;
        };
        ComputedFields: never;
        Insert: {
          client_id: string;
          created_at?: string;
          created_by?: string | null;
          grid_size?: number;
          id?: string;
          keyword: string;
          location_id: string;
          radius_km?: number;
        };
        Update: {
          client_id?: string;
          created_at?: string;
          created_by?: string | null;
          grid_size?: number;
          id?: string;
          keyword?: string;
          location_id?: string;
          radius_km?: number;
        };
        Relationships: [
          {
            foreignKeyName: "rank_keywords_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rank_keywords_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rank_keywords_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      rank_scan_points: {
        Row: {
          client_id: string;
          col_idx: number;
          lat: number;
          lng: number;
          rank: number | null;
          results: NonNullable<Json>;
          row_idx: number;
          scan_id: string;
        };
        ComputedFields: never;
        Insert: {
          client_id: string;
          col_idx: number;
          lat: number;
          lng: number;
          rank?: number | null;
          results?: NonNullable<Json>;
          row_idx: number;
          scan_id: string;
        };
        Update: {
          client_id?: string;
          col_idx?: number;
          lat?: number;
          lng?: number;
          rank?: number | null;
          results?: NonNullable<Json>;
          row_idx?: number;
          scan_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rank_scan_points_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rank_scan_points_scan_id_fkey";
            columns: ["scan_id"];
            isOneToOne: false;
            referencedRelation: "rank_scans";
            referencedColumns: ["id"];
          },
        ];
      };
      rank_scans: {
        Row: {
          arp: number | null;
          avg_rank: number | null;
          best_rank: number | null;
          center_lat: number;
          center_lng: number;
          client_id: string;
          created_at: string;
          error: string | null;
          finished_at: string | null;
          found_points: number | null;
          grid_size: number;
          id: string;
          keyword: string;
          keyword_id: string;
          location_id: string;
          points: number;
          provider: string;
          radius_km: number;
          requested_by: string | null;
          status: string;
          top3_points: number | null;
          worst_rank: number | null;
        };
        ComputedFields: never;
        Insert: {
          arp?: number | null;
          avg_rank?: number | null;
          best_rank?: number | null;
          center_lat: number;
          center_lng: number;
          client_id: string;
          created_at?: string;
          error?: string | null;
          finished_at?: string | null;
          found_points?: number | null;
          grid_size: number;
          id?: string;
          keyword: string;
          keyword_id: string;
          location_id: string;
          points: number;
          provider: string;
          radius_km: number;
          requested_by?: string | null;
          status?: string;
          top3_points?: number | null;
          worst_rank?: number | null;
        };
        Update: {
          arp?: number | null;
          avg_rank?: number | null;
          best_rank?: number | null;
          center_lat?: number;
          center_lng?: number;
          client_id?: string;
          created_at?: string;
          error?: string | null;
          finished_at?: string | null;
          found_points?: number | null;
          grid_size?: number;
          id?: string;
          keyword?: string;
          keyword_id?: string;
          location_id?: string;
          points?: number;
          provider?: string;
          radius_km?: number;
          requested_by?: string | null;
          status?: string;
          top3_points?: number | null;
          worst_rank?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "rank_scans_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rank_scans_keyword_id_fkey";
            columns: ["keyword_id"];
            isOneToOne: false;
            referencedRelation: "rank_keywords";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rank_scans_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rank_scans_requested_by_fkey";
            columns: ["requested_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      cancel_post_approval: {
        Args: { p_post_id: string };
        Returns: boolean;
      };
      expire_post_approvals: {
        Args: never;
        Returns: { approval_id: string; client_id: string; post_id: string }[];
      };
      open_post_approval: {
        Args: {
          p_channel: string;
          p_expires_at: string;
          p_post_id: string;
          p_sent_by: string;
          p_token_hash: string;
        };
        Returns: string;
      };
      respond_to_post_approval: {
        Args: { p_approval_id: string; p_decision: string; p_note: string; p_via: string };
        Returns: string;
      };
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
