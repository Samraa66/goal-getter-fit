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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      adjustment_history: {
        Row: {
          adjustment_type: string
          after_state: Json | null
          before_state: Json | null
          created_at: string | null
          id: string
          plan_version_id: string | null
          rule_applied: string
          triggered_by: string | null
          user_id: string
        }
        Insert: {
          adjustment_type: string
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string | null
          id?: string
          plan_version_id?: string | null
          rule_applied: string
          triggered_by?: string | null
          user_id: string
        }
        Update: {
          adjustment_type?: string
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string | null
          id?: string
          plan_version_id?: string | null
          rule_applied?: string
          triggered_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "adjustment_history_plan_version_id_fkey"
            columns: ["plan_version_id"]
            isOneToOne: false
            referencedRelation: "plan_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deviation_events: {
        Row: {
          auto_adjusted: boolean | null
          created_at: string | null
          deviation_type: Database["public"]["Enums"]["deviation_type"]
          id: string
          impact_budget: number | null
          impact_calories: number | null
          impact_protein: number | null
          notes: string | null
          reason: Database["public"]["Enums"]["deviation_reason"]
          related_meal_id: string | null
          related_workout_id: string | null
          user_id: string
        }
        Insert: {
          auto_adjusted?: boolean | null
          created_at?: string | null
          deviation_type: Database["public"]["Enums"]["deviation_type"]
          id?: string
          impact_budget?: number | null
          impact_calories?: number | null
          impact_protein?: number | null
          notes?: string | null
          reason: Database["public"]["Enums"]["deviation_reason"]
          related_meal_id?: string | null
          related_workout_id?: string | null
          user_id: string
        }
        Update: {
          auto_adjusted?: boolean | null
          created_at?: string | null
          deviation_type?: Database["public"]["Enums"]["deviation_type"]
          id?: string
          impact_budget?: number | null
          impact_calories?: number | null
          impact_protein?: number | null
          notes?: string | null
          reason?: Database["public"]["Enums"]["deviation_reason"]
          related_meal_id?: string | null
          related_workout_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deviation_events_related_meal_id_fkey"
            columns: ["related_meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deviation_events_related_workout_id_fkey"
            columns: ["related_workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      dining_out_events: {
        Row: {
          compensation_applied: boolean | null
          compensation_details: Json | null
          created_at: string | null
          estimated_calories: number | null
          estimated_cost: number | null
          estimated_protein: number | null
          id: string
          meal_type: string
          replaced_meal_id: string | null
          scanned_menu_id: string | null
          user_id: string
        }
        Insert: {
          compensation_applied?: boolean | null
          compensation_details?: Json | null
          created_at?: string | null
          estimated_calories?: number | null
          estimated_cost?: number | null
          estimated_protein?: number | null
          id?: string
          meal_type: string
          replaced_meal_id?: string | null
          scanned_menu_id?: string | null
          user_id: string
        }
        Update: {
          compensation_applied?: boolean | null
          compensation_details?: Json | null
          created_at?: string | null
          estimated_calories?: number | null
          estimated_cost?: number | null
          estimated_protein?: number | null
          id?: string
          meal_type?: string
          replaced_meal_id?: string | null
          scanned_menu_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dining_out_events_replaced_meal_id_fkey"
            columns: ["replaced_meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dining_out_events_scanned_menu_id_fkey"
            columns: ["scanned_menu_id"]
            isOneToOne: false
            referencedRelation: "scanned_menus"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          created_at: string | null
          duration_seconds: number | null
          id: string
          is_completed: boolean | null
          name: string
          notes: string | null
          order_index: number | null
          reps: string | null
          rest_seconds: number | null
          sets: number | null
          video_url: string | null
          weight: string | null
          workout_id: string
        }
        Insert: {
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          is_completed?: boolean | null
          name: string
          notes?: string | null
          order_index?: number | null
          reps?: string | null
          rest_seconds?: number | null
          sets?: number | null
          video_url?: string | null
          weight?: string | null
          workout_id: string
        }
        Update: {
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          is_completed?: boolean | null
          name?: string
          notes?: string | null
          order_index?: number | null
          reps?: string | null
          rest_seconds?: number | null
          sets?: number | null
          video_url?: string | null
          weight?: string | null
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercises_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plans: {
        Row: {
          created_at: string | null
          estimated_weekly_cost: number | null
          id: string
          plan_date: string
          plan_version_id: string | null
          total_calories: number | null
          total_carbs: number | null
          total_fats: number | null
          total_protein: number | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          estimated_weekly_cost?: number | null
          id?: string
          plan_date: string
          plan_version_id?: string | null
          total_calories?: number | null
          total_carbs?: number | null
          total_fats?: number | null
          total_protein?: number | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          estimated_weekly_cost?: number | null
          id?: string
          plan_date?: string
          plan_version_id?: string | null
          total_calories?: number | null
          total_carbs?: number | null
          total_fats?: number | null
          total_protein?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plans_plan_version_id_fkey"
            columns: ["plan_version_id"]
            isOneToOne: false
            referencedRelation: "plan_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meals: {
        Row: {
          calories: number | null
          carbs: number | null
          created_at: string | null
          description: string | null
          fats: number | null
          id: string
          image_url: string | null
          is_completed: boolean | null
          meal_plan_id: string
          meal_type: string
          name: string
          protein: number | null
          recipe: string | null
        }
        Insert: {
          calories?: number | null
          carbs?: number | null
          created_at?: string | null
          description?: string | null
          fats?: number | null
          id?: string
          image_url?: string | null
          is_completed?: boolean | null
          meal_plan_id: string
          meal_type: string
          name: string
          protein?: number | null
          recipe?: string | null
        }
        Update: {
          calories?: number | null
          carbs?: number | null
          created_at?: string | null
          description?: string | null
          fats?: number | null
          id?: string
          image_url?: string | null
          is_completed?: boolean | null
          meal_plan_id?: string
          meal_type?: string
          name?: string
          protein?: number | null
          recipe?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meals_meal_plan_id_fkey"
            columns: ["meal_plan_id"]
            isOneToOne: false
            referencedRelation: "meal_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_versions: {
        Row: {
          adjustment_reason: string | null
          constraints_snapshot: Json
          created_at: string | null
          estimated_weekly_cost: number | null
          id: string
          is_active: boolean | null
          plan_type: string
          user_id: string
          version_number: number
        }
        Insert: {
          adjustment_reason?: string | null
          constraints_snapshot: Json
          created_at?: string | null
          estimated_weekly_cost?: number | null
          id?: string
          is_active?: boolean | null
          plan_type: string
          user_id: string
          version_number?: number
        }
        Update: {
          adjustment_reason?: string | null
          constraints_snapshot?: Json
          created_at?: string | null
          estimated_weekly_cost?: number | null
          id?: string
          is_active?: boolean | null
          plan_type?: string
          user_id?: string
          version_number?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          age: number | null
          allergies: string[] | null
          avatar_url: string | null
          created_at: string | null
          daily_calorie_target: number | null
          daily_food_budget: number | null
          dietary_preference: string | null
          disliked_foods: string[] | null
          email: string | null
          experience_level: string | null
          fitness_goal: string | null
          full_name: string | null
          height_cm: number | null
          id: string
          onboarding_completed: boolean | null
          updated_at: string | null
          weight_current: number | null
          weight_goal: number | null
          workout_location: string | null
        }
        Insert: {
          age?: number | null
          allergies?: string[] | null
          avatar_url?: string | null
          created_at?: string | null
          daily_calorie_target?: number | null
          daily_food_budget?: number | null
          dietary_preference?: string | null
          disliked_foods?: string[] | null
          email?: string | null
          experience_level?: string | null
          fitness_goal?: string | null
          full_name?: string | null
          height_cm?: number | null
          id: string
          onboarding_completed?: boolean | null
          updated_at?: string | null
          weight_current?: number | null
          weight_goal?: number | null
          workout_location?: string | null
        }
        Update: {
          age?: number | null
          allergies?: string[] | null
          avatar_url?: string | null
          created_at?: string | null
          daily_calorie_target?: number | null
          daily_food_budget?: number | null
          dietary_preference?: string | null
          disliked_foods?: string[] | null
          email?: string | null
          experience_level?: string | null
          fitness_goal?: string | null
          full_name?: string | null
          height_cm?: number | null
          id?: string
          onboarding_completed?: boolean | null
          updated_at?: string | null
          weight_current?: number | null
          weight_goal?: number | null
          workout_location?: string | null
        }
        Relationships: []
      }
      progress_logs: {
        Row: {
          calories_burned: number | null
          calories_consumed: number | null
          created_at: string | null
          id: string
          log_date: string
          mood: string | null
          notes: string | null
          sleep_hours: number | null
          user_id: string
          water_glasses: number | null
          weight: number | null
        }
        Insert: {
          calories_burned?: number | null
          calories_consumed?: number | null
          created_at?: string | null
          id?: string
          log_date: string
          mood?: string | null
          notes?: string | null
          sleep_hours?: number | null
          user_id: string
          water_glasses?: number | null
          weight?: number | null
        }
        Update: {
          calories_burned?: number | null
          calories_consumed?: number | null
          created_at?: string | null
          id?: string
          log_date?: string
          mood?: string | null
          notes?: string | null
          sleep_hours?: number | null
          user_id?: string
          water_glasses?: number | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "progress_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scanned_menus: {
        Row: {
          analysis_result: Json | null
          calories_estimate: number | null
          created_at: string | null
          id: string
          image_url: string | null
          restaurant_name: string | null
          selected_meal: string | null
          user_id: string
        }
        Insert: {
          analysis_result?: Json | null
          calories_estimate?: number | null
          created_at?: string | null
          id?: string
          image_url?: string | null
          restaurant_name?: string | null
          selected_meal?: string | null
          user_id: string
        }
        Update: {
          analysis_result?: Json | null
          calories_estimate?: number | null
          created_at?: string | null
          id?: string
          image_url?: string | null
          restaurant_name?: string | null
          selected_meal?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scanned_menus_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_constraints: {
        Row: {
          created_at: string | null
          equipment_access: string[] | null
          id: string
          max_cooking_time_minutes: number | null
          meals_per_day: number | null
          preferred_workout_days: number[] | null
          protein_target_grams: number | null
          simplify_after_deviations: number | null
          updated_at: string | null
          user_id: string
          weekly_food_budget: number | null
          workout_duration_minutes: number | null
          workouts_per_week: number | null
        }
        Insert: {
          created_at?: string | null
          equipment_access?: string[] | null
          id?: string
          max_cooking_time_minutes?: number | null
          meals_per_day?: number | null
          preferred_workout_days?: number[] | null
          protein_target_grams?: number | null
          simplify_after_deviations?: number | null
          updated_at?: string | null
          user_id: string
          weekly_food_budget?: number | null
          workout_duration_minutes?: number | null
          workouts_per_week?: number | null
        }
        Update: {
          created_at?: string | null
          equipment_access?: string[] | null
          id?: string
          max_cooking_time_minutes?: number | null
          meals_per_day?: number | null
          preferred_workout_days?: number[] | null
          protein_target_grams?: number | null
          simplify_after_deviations?: number | null
          updated_at?: string | null
          user_id?: string
          weekly_food_budget?: number | null
          workout_duration_minutes?: number | null
          workouts_per_week?: number | null
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          created_at: string | null
          id: string
          monthly_ai_messages_used: number | null
          monthly_regenerations_used: number | null
          reset_at: string | null
          tier: Database["public"]["Enums"]["subscription_tier"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          monthly_ai_messages_used?: number | null
          monthly_regenerations_used?: number | null
          reset_at?: string | null
          tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          monthly_ai_messages_used?: number | null
          monthly_regenerations_used?: number | null
          reset_at?: string | null
          tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      weekly_checkins: {
        Row: {
          adjustment_applied: boolean | null
          adjustment_details: Json | null
          budget_adherence: Database["public"]["Enums"]["adherence_level"]
          created_at: string | null
          id: string
          meal_adherence: Database["public"]["Enums"]["adherence_level"]
          notes: string | null
          primary_reason: Database["public"]["Enums"]["deviation_reason"] | null
          user_id: string
          week_start: string
          workout_adherence: Database["public"]["Enums"]["adherence_level"]
        }
        Insert: {
          adjustment_applied?: boolean | null
          adjustment_details?: Json | null
          budget_adherence: Database["public"]["Enums"]["adherence_level"]
          created_at?: string | null
          id?: string
          meal_adherence: Database["public"]["Enums"]["adherence_level"]
          notes?: string | null
          primary_reason?:
            | Database["public"]["Enums"]["deviation_reason"]
            | null
          user_id: string
          week_start: string
          workout_adherence: Database["public"]["Enums"]["adherence_level"]
        }
        Update: {
          adjustment_applied?: boolean | null
          adjustment_details?: Json | null
          budget_adherence?: Database["public"]["Enums"]["adherence_level"]
          created_at?: string | null
          id?: string
          meal_adherence?: Database["public"]["Enums"]["adherence_level"]
          notes?: string | null
          primary_reason?:
            | Database["public"]["Enums"]["deviation_reason"]
            | null
          user_id?: string
          week_start?: string
          workout_adherence?: Database["public"]["Enums"]["adherence_level"]
        }
        Relationships: []
      }
      workout_programs: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          plan_version_id: string | null
          user_id: string
          week_number: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          plan_version_id?: string | null
          user_id: string
          week_number?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          plan_version_id?: string | null
          user_id?: string
          week_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_programs_plan_version_id_fkey"
            columns: ["plan_version_id"]
            isOneToOne: false
            referencedRelation: "plan_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_programs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workouts: {
        Row: {
          completed_at: string | null
          created_at: string | null
          day_of_week: number
          duration_minutes: number | null
          id: string
          is_completed: boolean | null
          name: string
          program_id: string
          workout_type: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          day_of_week: number
          duration_minutes?: number | null
          id?: string
          is_completed?: boolean | null
          name: string
          program_id: string
          workout_type: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          day_of_week?: number
          duration_minutes?: number | null
          id?: string
          is_completed?: boolean | null
          name?: string
          program_id?: string
          workout_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "workouts_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "workout_programs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_subscription_limit: {
        Args: { p_limit_type: string; p_user_id: string }
        Returns: Json
      }
      increment_usage: {
        Args: { p_usage_type: string; p_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      adherence_level: "yes" | "partial" | "no"
      deviation_reason:
        | "time"
        | "budget"
        | "energy"
        | "preference"
        | "dining_out"
        | "illness"
        | "other"
      deviation_type:
        | "skipped_workout"
        | "shortened_workout"
        | "missed_meal"
        | "substituted_meal"
        | "dining_out"
        | "budget_exceeded"
      subscription_tier: "free" | "paid"
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
      adherence_level: ["yes", "partial", "no"],
      deviation_reason: [
        "time",
        "budget",
        "energy",
        "preference",
        "dining_out",
        "illness",
        "other",
      ],
      deviation_type: [
        "skipped_workout",
        "shortened_workout",
        "missed_meal",
        "substituted_meal",
        "dining_out",
        "budget_exceeded",
      ],
      subscription_tier: ["free", "paid"],
    },
  },
} as const
