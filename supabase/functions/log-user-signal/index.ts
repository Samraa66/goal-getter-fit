import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  unauthorizedResponse,
  badRequestResponse,
  validatePayloadSize,
  authenticateUser,
  MAX_TEXT_PAYLOAD_SIZE,
} from "../_shared/security.ts";

const ALLOWED_SIGNAL_TYPES = [
  "meal_completed",
  "meal_skipped",
  "meal_swapped",
  "workout_completed",
  "workout_skipped",
  "food_scanned",
  "coach_message",
  "water_logged",
  "checkin_submitted",
] as const;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payloadError = validatePayloadSize(
      req.headers.get("content-length"),
      MAX_TEXT_PAYLOAD_SIZE
    );
    if (payloadError) {
      return badRequestResponse(payloadError);
    }

    const authResult = await authenticateUser(req);
    if (authResult instanceof Response) {
      return authResult;
    }

    const { user, supabase } = authResult;
    const userId = user.id;

    const body = await req.json().catch(() => ({}));
    const { signal_type, payload } = body;

    if (!signal_type || typeof signal_type !== "string") {
      return badRequestResponse("signal_type is required and must be a string");
    }

    if (!ALLOWED_SIGNAL_TYPES.includes(signal_type as any)) {
      return badRequestResponse(
        `signal_type must be one of: ${ALLOWED_SIGNAL_TYPES.join(", ")}`
      );
    }

    const payloadObj =
      payload && typeof payload === "object" && !Array.isArray(payload)
        ? payload
        : {};

    const { error } = await supabase.from("user_signals").insert({
      user_id: userId,
      signal_type,
      payload: payloadObj,
    });

    if (error) {
      console.error("Log user signal error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to log signal" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Log user signal error:", error);
    return new Response(
      JSON.stringify({ error: "Something went wrong" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
