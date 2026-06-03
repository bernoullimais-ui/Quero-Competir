export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      tournaments: {
        Row: {
          id: string
          name: string
          start_date: string
          end_date: string | null
          location: string | null
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          start_date: string
          end_date?: string | null
          location?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          start_date?: string
          end_date?: string | null
          location?: string | null
          status?: string
          updated_at?: string
        }
      }
      matches: {
        Row: {
          id: string
          tournament_id: string
          category_id: string
          team1_id: string | null
          team2_id: string | null
          score1: number | null
          score2: number | null
          status: string
          round: number
          match_index: number
          next_match_id: string | null
          winner_id: string | null
          loser_id: string | null
          venue_id: string | null
          scheduled_time: string | null
          created_at: string
          updated_at: string
          is_timer_running: boolean
          timer_base_seconds: number
          timer_last_started_at: string | null
        }
        Insert: {
          id?: string
          tournament_id: string
          category_id: string
          team1_id?: string | null
          team2_id?: string | null
          score1?: number | null
          score2?: number | null
          status?: string
          round: number
          match_index?: number
          next_match_id?: string | null
          winner_id?: string | null
          loser_id?: string | null
          venue_id?: string | null
          scheduled_time?: string | null
          created_at?: string
          updated_at?: string
          is_timer_running?: boolean
          timer_base_seconds?: number
          timer_last_started_at?: string | null
        }
        Update: {
          id?: string
          tournament_id?: string
          category_id?: string
          team1_id?: string | null
          team2_id?: string | null
          score1?: number | null
          score2?: number | null
          status?: string
          round?: number
          match_index?: number
          next_match_id?: string | null
          winner_id?: string | null
          loser_id?: string | null
          venue_id?: string | null
          scheduled_time?: string | null
          updated_at?: string
          is_timer_running?: boolean
          timer_base_seconds?: number
          timer_last_started_at?: string | null
        }
      }
      categories: {
        Row: {
          id: string
          tournament_id: string
          name: string
          gender: string
          dispute_system: string
          group_count: number | null
          created_at: string
          updated_at: string
        }
      }
      institutions: {
        Row: {
          id: string
          name: string
          short_name: string
          city: string
          state: string
          logo_url: string | null
          created_at: string
        }
      }
      athletes: {
        Row: {
          id: string
          institution_id: string
          name: string
          document: string
          birth_date: string
          gender: string
          created_at: string
        }
      }
      teams: {
        Row: {
          id: string
          tournament_id: string
          category_id: string
          institution_id: string
          coach_name: string | null
          created_at: string
        }
      }
      venues: {
        Row: {
          id: string
          name: string
          address: string | null
          organizer_id: string | null
          created_at: string
          availability: any[] | null
          courts: any[] | null
          courts_count: number | null
          courts_json: any[] | null
        }
        Insert: {
          id?: string
          name: string
          address?: string | null
          organizer_id?: string | null
          created_at?: string
          availability?: any[] | null
          courts?: any[] | null
          courts_count?: number | null
          courts_json?: any[] | null
        }
        Update: {
          id?: string
          name?: string
          address?: string | null
          organizer_id?: string | null
          created_at?: string
          availability?: any[] | null
          courts?: any[] | null
          courts_count?: number | null
          courts_json?: any[] | null
        }
      }
      organizations: {
        Row: {
          id: string
          name: string
          cnpj: string | null
          description: string | null
          email: string | null
          phone: string | null
          logo_url: string | null
          primary_color: string | null
          secondary_color: string | null
          font_family: string | null
          theme_mode: string | null
          website: string | null
          instagram: string | null
          youtube: string | null
          subdomain: string | null
          auto_approve_registrations: boolean | null
          show_incomplete_brackets: boolean | null
          requires_membership_fee: boolean | null
          membership_fee_amount: number | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          cnpj?: string | null
          description?: string | null
          email?: string | null
          phone?: string | null
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          font_family?: string | null
          theme_mode?: string | null
          website?: string | null
          instagram?: string | null
          youtube?: string | null
          subdomain?: string | null
          auto_approve_registrations?: boolean | null
          show_incomplete_brackets?: boolean | null
          requires_membership_fee?: boolean | null
          membership_fee_amount?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          cnpj?: string | null
          description?: string | null
          email?: string | null
          phone?: string | null
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          font_family?: string | null
          theme_mode?: string | null
          website?: string | null
          instagram?: string | null
          youtube?: string | null
          subdomain?: string | null
          auto_approve_registrations?: boolean | null
          show_incomplete_brackets?: boolean | null
          requires_membership_fee?: boolean | null
          membership_fee_amount?: number | null
          created_at?: string
        }
      }
      staff: {
        Row: {
          id: string
          name: string
          role: string
          organizer_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          role: string
          organizer_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          role?: string
          organizer_id?: string | null
          created_at?: string
        }
      }
      portal_accounts: {
        Row: {
          id: string
          email: string
          password_hash: string
          role: string
          name: string
          reference_id: string | null
          created_at: string
        }
        Insert: {
          id: string
          email: string
          password_hash: string
          role: string
          name: string
          reference_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          password_hash?: string
          role?: string
          name?: string
          reference_id?: string | null
          created_at?: string
        }
      }
      match_events: {
        Row: {
          id: string
          match_id: string
          team_id: string | null
          athlete_id: string | null
          event_type: string
          match_time: string | null
          created_at: string
        }
      }
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
