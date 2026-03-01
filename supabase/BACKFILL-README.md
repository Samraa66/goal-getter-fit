# Backfill missing tables (Lovable vs Supabase)

If your Supabase project only has `profiles`, `user_insights`, and `user_signals` (e.g. after linking a new project or repair marking migrations applied too early), the rest of the schema (meal_templates, user_meals, user_workouts, chat_sessions, etc.) never ran. Use this to fix it.

## Step 1: Run the backfill SQL once

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project → **SQL Editor**.
2. Paste and run the contents of **`supabase/backfill-missing-tables.sql`** (or run the file if your client supports it).

This creates the tables that migration 1 would have created (except `profiles`, which you already have) plus **`meal_templates`** (referenced by later migrations but not defined in any migration in this repo), and their RLS policies.

## Step 2: Revert then push migrations

From the project root:

```bash
bash scripts/repair-and-push-migrations.sh
```

That script marks migrations 2–22 as **reverted**, then runs `supabase db push --include-all` so those migrations are applied (they’re earlier than the last applied migration on remote). (e.g. `user_meals`, `user_workouts`, `workout_templates`, `chat_sessions`, seed data, and later drop legacy tables).

## Step 3: Confirm

In Supabase **Table Editor** you should see tables such as:

- `profiles`, `user_insights`, `user_signals`
- `meal_templates`, `workout_templates`
- `user_meals`, `user_workouts`, `user_daily_meals`
- `chat_sessions`, `chat_messages`
- `daily_plans`, `daily_plan_meals`, `daily_plan_workouts`
- `progress_logs`, `scanned_menus`, `user_subscriptions`, etc.

(Some legacy tables from the first migration are dropped by a later migration; that’s expected.)
