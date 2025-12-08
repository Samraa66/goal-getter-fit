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
          id: string
          plan_date: string
          total_calories: number | null
          total_carbs: number | null
          total_fats: number | null
          total_protein: number | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          plan_date: string
          total_calories?: number | null
          total_carbs?: number | null
          total_fats?: number | null
          total_protein?: number | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          plan_date?: string
          total_calories?: number | null
          total_carbs?: number | null
          total_fats?: number | null
          total_protein?: number | null
          user_id?: string
        }
        Relationships: [
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
      workout_programs: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          user_id: string
          week_number: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          user_id: string
          week_number?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          user_id?: string
          week_number?: number | null
        }
        Relationships: [
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
