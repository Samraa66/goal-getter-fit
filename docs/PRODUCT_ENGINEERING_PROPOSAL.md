# Fitness & Nutrition App — Product Engineering Proposal

**Senior AI Product Engineer · Reliability, Deterministic + AI, Maintainability**

This document analyzes the existing codebase and proposes improvements across template architecture, generation logic, personalization, regeneration, data consistency, and production scalability—**without removing existing functionality**.

---

## Implementation status (Phases 1–5 done)

| Phase | Done | Notes |
|-------|------|--------|
| **1. Reliability** | ✅ | `_shared/validation.ts`, `_shared/meal-utils.ts`; validation + fallback in personalize-meal and personalize-workout; `plan_generations` migration; idempotency in generate-weekly-meal-plan |
| **2. Template selection** | ✅ | `_shared/template-selection.ts` (selectMealTemplate); used in generate-weekly-meal-plan and personalize-meal; deterministic tie-break |
| **3. Feedback & affinity** | ✅ | `plan_feedback` migration; template_affinity used in personalize-workout buildBalancedSelection |
| **4. Schema extensions** | ✅ | Optional columns on meal_templates, workout_templates, user_insights (version, is_active, last_*_at, etc.) |
| **5. Client hardening** | ✅ | Idempotency key in useWeeklyMealPlan; 429/402 handling in useWeeklyMealPlan, useTemplateMeals, useTemplateWorkouts |

---

## 1. Current State Summary

| Area | Current Implementation | Gaps |
|------|------------------------|-----|
| **Templates** | `meal_templates`, `workout_templates` with `goal_type`, `meal_type`, tags, `data` (JSONB). Optional `batch_friendly`, `muscle_group_focus`, `training_split`. | No versioning; no explicit “template quality” or usage stats; meal template creation was missing from migrations (backfilled). |
| **Generation** | `generate-weekly-meal-plan` (7-day, template-based, slot distribution, batch mode). `personalize-meal` / `personalize-workout` (AI) for premium. Free tier: direct template copy or random pick per slot. | Template selection uses `Math.random()`; no deterministic fallback; no idempotency key; regeneration replaces entire week. |
| **Personalization** | AI adjusts macros/allergies via Lovable gateway; `user_insights` (avoided_foods, favorite_cuisines, template_affinity) used in prompts and selection. | No schema validation on AI output; no retry/fallback to scaled template if AI fails. |
| **Regeneration** | `useProfileUpdates` calls `generate-weekly-meal-plan` and `personalize-workout`; premium gate for full meal regen. | No “regeneration reason” or versioning; no partial regen (e.g. one day). |
| **Feedback** | `user_signals` (meal_completed, meal_skipped, workout_completed, etc.); `recompute_user_insights` in SQL. | No explicit “plan feedback” (thumbs up/down, swap reason); template_affinity not yet used in selection in all code paths. |
| **Validation** | Payload size and signal_type allowlist in `log-user-signal`; rate limit (10/day, 10s cooldown) via `check_ai_rate_limit`. | No validation of meal/workout structure or macro bounds before insert. |
| **Deployment** | Edge functions, RLS, single Supabase project. | No generation pipeline idempotency; no feature flags or tier-based limits in one place. |

---

## 2. Improved Database Schema

**Principles:** Add only what’s needed for reliability and analytics; keep existing tables and RLS.

### 2.1 Template Layer (extend, do not replace)

- **`meal_templates`** — Add optional columns:
  - `version integer DEFAULT 1` — for future A/B or rollback.
  - `min_calories`, `max_calories` (integer, nullable) — for validation and slot bounds.
  - `is_active boolean DEFAULT true` — soft disable without deleting.
- **`workout_templates`** — Already has `muscle_group_focus`, `training_split` (migration 20260223231906). Add:
  - `is_active boolean DEFAULT true`.
  - `version integer DEFAULT 1`.

### 2.2 Generation Audit & Idempotency

- **`plan_generations`** (new table)
  - `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
  - `user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE`
  - `generation_type text NOT NULL` — e.g. `weekly_meal`, `single_day_meal`, `workout_week`
  - `scope text` — e.g. `2025-02-26` (single day) or `2025-02-26_week` (week starting)
  - `idempotency_key text UNIQUE` — client or job ID to prevent duplicate runs
  - `status text NOT NULL DEFAULT 'started'` — `started | completed | failed`
  - `input_snapshot jsonb` — profile/insights summary (optional, for debugging)
  - `result_summary jsonb` — e.g. `{ "meals_created": 21, "days_planned": 7 }`
  - `error_message text` — if failed
  - `created_at timestamptz DEFAULT now()`
  - Indexes: `(user_id, generation_type, created_at)`, `(idempotency_key)`.

Use: before running a generation, insert with `idempotency_key`; on conflict do nothing and return existing row; on success/failure update `status` and result/error.

### 2.3 Feedback & Quality

- **`user_signals`** — Already has `signal_type` and `payload`. No schema change.
- **`plan_feedback`** (new table, optional)
  - `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
  - `user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE`
  - `target_type text NOT NULL` — `meal_plan | workout_plan | single_meal | single_workout`
  - `target_id text` — e.g. `user_meal_id` or `user_workout_id` or week scope
  - `rating smallint` — e.g. 1–5 or -1/1 for thumbs down/up
  - `reason text` — optional (e.g. “too heavy”, “didn’t like”)
  - `created_at timestamptz DEFAULT now()`
  - Index: `(user_id, target_type, created_at)`.

This supports “improve next time” without changing existing signals.

### 2.4 User Insights (extend)

- **`user_insights`** — Add optional columns:
  - `last_meal_plan_at timestamptz`
  - `last_workout_plan_at timestamptz`
  - `preferred_meal_slots jsonb` — e.g. `{"breakfast": "07:00", "lunch": "12:30"}` (from signals or check-ins).

Keep existing columns; these support “when did we last generate” and smarter defaults.

---

## 3. Generation Pipeline Architecture

**Goals:** Deterministic where possible; AI where it adds value; one place for rate limits and idempotency.

### 3.1 Pipeline Stages (conceptual)

1. **Auth & idempotency** — Resolve user; check/create `plan_generations` row by `idempotency_key`; if status = completed, return cached result.
2. **Context load** — Profile, `user_insights`, subscription tier, (optional) last generation summary. Single “context” object passed through pipeline.
3. **Template selection** — Deterministic algorithm (see §4) producing a list of template IDs per slot/day.
4. **Personalization** — For each selected template:  
   - **Free:** Scale template to target calories/macros (existing `scaleTemplate`).  
   - **Premium:** Call AI personalization; on failure or invalid output, **fallback** to scaled template and log.
5. **Validation** — Validate each personalized meal/workout (see §6); if invalid, replace with scaled template and log.
6. **Write** — Transaction: delete existing plan for scope, insert `user_meals` / `user_daily_meals` (or workouts); update `plan_generations` status and result_summary.
7. **Signals** — Optionally emit a single “plan_generated” internal event for analytics (no change to existing user_signals if not needed).

### 3.2 Where to Implement

- **`generate-weekly-meal-plan`** — Add idempotency key (from body or derive from `user_id + start_date + "weekly"`). Move “template selection” into a shared helper (or shared Deno module) that uses the **template selection algorithm** below. After generation, upsert `plan_generations`.
- **`personalize-meal`** / **`personalize-workout`** — Keep as “personalization-only” endpoints used by the pipeline; add validation layer and fallback to scaled template on AI failure or invalid JSON.
- **New optional:** A single “orchestrator” edge function (e.g. `generate-plan`) that runs meal and/or workout generation in sequence with one idempotency key—only if you want a single API for “regenerate everything”.

### 3.3 Rate Limits & Tiers

- Keep `check_ai_rate_limit` for AI calls; consider moving limits to `user_subscriptions` (e.g. `monthly_ai_generations`, `daily_plan_regenerations`) so paid tier can have higher limits.
- In pipeline: after idempotency check, call rate limit once per “generation request,” not per meal.

---

## 4. Template Selection Algorithm

**Goal:** Prefer variety, respect user insights and constraints, deterministic when no tie-breaker needed.

### 4.1 Meal Template Selection (per slot per day)

1. **Filter** — `goal_type` = mapped from profile; `meal_type` = slot (map snack_2/snack_3 → snack); `is_active = true` if column exists.
2. **Exclude** — Remove templates that contain any of `user_insights.avoided_foods` or profile `allergies`/`disliked_foods` in name/tags (existing logic).
3. **Score** — For each candidate:
   - `affinity = template_affinity[template.id]` (from user_insights); clamp to [−1, 1].
   - `cuisine_bonus = 0.3` if template tags match `favorite_cuisines`, else 0.
   - `score = affinity + cuisine_bonus`.
4. **Variety** — Within the same week, track “already used template IDs” per slot (existing `usedTemplateIds`). Prefer templates not yet used this week; if all used, clear and allow reuse.
5. **Choose** — Sort by score descending; among top N (e.g. N = 5), pick **deterministically** by `hash(user_id + date + slot + template_id) % N` so the same user/date/slot gives the same “top bucket,” then pick one from that bucket. Alternatively, keep one random pick from top 5 for variety but seed with `date + slot` for reproducibility in tests.
6. **Batch mode** — If `cooking_style_preference = batch_cook_weekly`, restrict to `batch_friendly = true` when available (existing behavior).

Deliverables: a **shared function** (e.g. in `_shared/template-selection.ts`) used by `generate-weekly-meal-plan` and, if applicable, single-day meal generation.

### 4.2 Workout Template Selection

- Keep and refine `buildBalancedSelection`: group by `muscle_group_focus` / `training_split`, rotate through split (e.g. push/pull/legs), prefer templates not used this week.
- Add **template_affinity** from `user_insights`: when choosing within a focus group, sort by affinity descending before picking.
- Use deterministic tie-break (e.g. template id sort) when scores are equal so logs are reproducible.

---

## 5. Personalization Logic

**Goal:** Consistent structure in and out; clear fallback when AI is unavailable or returns bad data.

### 5.1 Meal Personalization

- **Input contract** — Selected templates + user context (calorie target, allergies, avoided foods, favorite cuisines, most_skipped_meal_type).
- **AI** — Keep current Lovable gateway prompt; add explicit “output schema” in the prompt (e.g. JSON Schema snippet) and require “same keys as input; only change quantities and optional substitutions.”
- **Post-process** — Run **validation** (see §6). If invalid: replace with `scaleTemplate(template, targetCalories)` and log to `plan_generations.error_message` or a small “fallback_used” array in result_summary.
- **Free tier** — No change: use scaled template only (already in place).

### 5.2 Workout Personalization

- Same idea: AI adapts reps/sets/difficulty; validate structure and ranges; fallback to template as-is or with simple scaling (e.g. reduce sets by 20% for “lighter”).
- Pass `user_insights.workout_consistency_score` and `most_completed_workout_type` into the prompt (already done); add “if consistency low, prefer simpler workouts” as a rule.

### 5.3 Shared Constants

- Define **macro bounds** (e.g. min/max calories per meal, min protein) and **structure rules** (required keys in `data`) in a shared module so both validation and prompts stay in sync.

---

## 6. Validation Layer

**Goal:** No invalid or dangerous data written to DB; graceful fallback.

### 6.1 Meal Validation (per meal)

- **Structure** — `personalized_data` has `meal_name`, `servings`, `ingredients` (array); each ingredient has `ingredient_name`, `grams`, `calories`, `protein_g`, `carbs_g`, `fats_g`.
- **Ranges** — `total_calories` in [100, 2000] per meal; each ingredient `grams` > 0; `protein_g`/`carbs_g`/`fats_g` non-negative.
- **Allergens** — If profile has `allergies`, ensure no ingredient name contains any allergen (case-insensitive).
- **Implementation** — Pure function `validateMealPersonalization(meal, profile) => { valid: boolean, errors?: string[] }` in `_shared/validation.ts`. Used by `personalize-meal` and by `generate-weekly-meal-plan` if it ever calls AI.

### 6.2 Workout Validation

- **Structure** — `personalized_data` has `workout_name`, `exercises` (array); each exercise has `exercise_name`, `sets`, `reps`, etc.
- **Ranges** — `sets` in [1, 20], `reps` reasonable (e.g. 1–100 or "AMRAP"), duration in sensible range.
- Same pattern: `validateWorkoutPersonalization(workout, profile) => { valid, errors }`.

### 6.3 Usage

- Before inserting into `user_meals` / `user_workouts`, run the validator. If invalid, do not insert that item; use fallback (scaled template) and record that fallback was used (e.g. in `plan_generations.result_summary.fallback_meals`).

---

## 7. Feedback Tracking System

**Goal:** Use feedback to improve selection and personalization over time; keep existing signals.

### 7.1 Keep Current Signals

- `user_signals` (meal_completed, meal_skipped, workout_completed, etc.) and `recompute_user_insights` stay as-is. They already drive `template_affinity`, `most_skipped_meal_type`, `most_completed_workout_type`, etc.

### 7.2 Optional Explicit Feedback

- If you add **plan_feedback** (thumbs up/down or 1–5 after viewing a plan):
  - Store in `plan_feedback`.
  - In `recompute_user_insights`, you can aggregate “recent plan ratings” and expose e.g. `avg_plan_rating` or `last_feedback_at` for use in prompts or selection (e.g. “user often rates plans low → prefer more variety next time”).

### 7.3 Swap and Regeneration as Signals

- **Swap:** When user swaps a meal (swap-meal), already have context. Optionally log a `user_signals` entry with `signal_type: 'meal_swapped'` and payload `{ meal_template_id_old, meal_template_id_new, reason }` so insights can learn “users often swap out X for Y.”
- **Regeneration:** When user triggers “regenerate plan,” optional signal `plan_regenerated` with payload `{ reason: 'user_request' | 'profile_update', scope: 'meals' | 'workouts' | 'both' }` for analytics. No schema change required if you pass this in existing flows.

### 7.4 Template Affinity in All Paths

- Ensure **generate-weekly-meal-plan** and **personalize-meal** both use `template_affinity` and `favorite_cuisines` when scoring templates (generate-weekly-meal-plan already does; personalize-meal picks “one per type” randomly—consider adding affinity sort before random pick).
- **personalize-workout** already uses consistency and most_completed type; ensure `template_affinity` is used in `buildBalancedSelection` when choosing within a focus group.

---

## 8. Deployment-Ready Architecture

**Goals:** Safe deploys; clear limits; no breaking changes.

### 8.1 Environment & Secrets

- All Supabase URLs and keys from env; no hardcoding. Lovable API key for AI only in edge function env.
- Optional: `FEATURE_USE_PLAN_FEEDBACK` or `AI_PERSONALIZATION_ENABLED` to toggle new behavior without code deploy.

### 8.2 Idempotency

- Every “create plan” request (weekly or single-day) should accept an optional `idempotency_key`. Store in `plan_generations`; if key exists and status = completed, return stored result and do not re-run. Prevents double plans on retries or double-clicks.

### 8.3 Tiered Limits (single place)

- Extend `check_ai_rate_limit` or add a small wrapper that:
  - Reads tier from `user_subscriptions`.
  - Applies per-tier daily/monthly limits (e.g. free: 10/day, paid: 100/day or unlimited).
  - Returns `allowed`, `remaining`, `reset_at` in response so the client can show “X generations left today.”

### 8.4 Errors and Observability

- All generation endpoints: catch errors, set `plan_generations.status = 'failed'` and `error_message` when applicable; return consistent JSON `{ success, error?, result_summary? }`.
- Log to Supabase logs or external logger: generation_type, user_id (or hash), duration, fallback_used. Avoid logging full PII in payloads.

### 8.5 Migrations and Backfills

- New tables (`plan_generations`, `plan_feedback`) and new columns on templates/insights: add via migrations with `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` so existing DBs (including Lovable Cloud) stay compatible.
- Do not drop or rename existing columns used by the app.

### 8.6 Client

- App continues to call `generate-weekly-meal-plan`, `personalize-meal`, `personalize-workout` as today. Optionally send `idempotency_key: uuid()` from the client on “Generate” to avoid duplicate plans on network retry.
- Handle 429 (rate limit) and 402 (quota) with clear messages and optional “Upgrade” CTA.

---

## 9. Implementation Order (Suggested)

1. **Phase 1 — Reliability**
   - Add validation layer (`_shared/validation.ts`) and use it in `personalize-meal` / `personalize-workout` with fallback to scaled template.
   - Add idempotency to `generate-weekly-meal-plan` (table `plan_generations` + key in body).

2. **Phase 2 — Template selection**
   - Extract template scoring (affinity + cuisine + variety) into shared logic; use it in `generate-weekly-meal-plan` and optionally in `personalize-meal` for the “pick templates” step.
   - Add deterministic tie-break (e.g. by template id) when scores are equal.

3. **Phase 3 — Feedback and insights**
   - Add `plan_feedback` table and optional “Rate this plan” UI; optionally feed into insights.
   - Ensure template_affinity is used in all selection paths (meals and workouts).

4. **Phase 4 — Schema and pipeline**
   - Add optional columns to templates (version, is_active, min/max_calories) and user_insights (last_meal_plan_at, etc.).
   - Optional: orchestrator endpoint and tiered rate limits in one place.

5. **Phase 5 — Production hardening**
   - Feature flags for new behavior; observability and error_message logging; client idempotency key and 429/402 handling.

---

## 10. Summary

| Proposal | Purpose |
|----------|---------|
| **Schema** | `plan_generations` (idempotency + audit), optional `plan_feedback`; optional columns on templates and user_insights. |
| **Pipeline** | Clear stages: idempotency → context → template selection → personalization (with fallback) → validation → write. |
| **Template selection** | Score by affinity + cuisine; variety (avoid reuse in same week); deterministic tie-break; shared module. |
| **Personalization** | Keep AI; add output validation and fallback to scaled template; shared constants for bounds. |
| **Validation** | `validateMealPersonalization` / `validateWorkoutPersonalization` before insert; block invalid; use fallback and log. |
| **Feedback** | Keep user_signals + recompute_user_insights; add optional plan_feedback; use template_affinity everywhere. |
| **Deployment** | Idempotency keys; tiered limits; safe migrations; consistent error responses; optional feature flags. |

All of this **extends** the current design: existing tables, RLS, and edge functions remain; new tables and shared modules add reliability, determinism where useful, and a path to production without breaking existing functionality.
