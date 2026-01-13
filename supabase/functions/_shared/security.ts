// Shared security utilities for edge functions

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Maximum payload sizes (in bytes)
export const MAX_PAYLOAD_SIZE = 10 * 1024 * 1024; // 10MB for images
export const MAX_TEXT_PAYLOAD_SIZE = 50 * 1024; // 50KB for text-only payloads
export const MAX_MESSAGE_LENGTH = 2000; // Max characters per message
export const MAX_MESSAGES_IN_CONTEXT = 20; // Max messages to send to AI

// Rate limit error response
export function rateLimitResponse(message: string, waitSeconds?: number) {
  return new Response(
    JSON.stringify({ 
      error: 'rate_limit', 
      message,
      wait_seconds: waitSeconds 
    }),
    {
      status: 429,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

// Unauthorized response
export function unauthorizedResponse(message = 'Unauthorized') {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

// Bad request response
export function badRequestResponse(message: string) {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

// Quota exceeded response
export function quotaExceededResponse(message: string) {
  return new Response(
    JSON.stringify({ error: 'quota_exceeded', message }),
    {
      status: 402,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

// Server error response
export function serverErrorResponse(message: string) {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

// Success response
export function successResponse(data: any) {
  return new Response(
    JSON.stringify(data),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

// Validate payload size
export function validatePayloadSize(contentLength: string | null, maxSize: number): string | null {
  if (!contentLength) return null; // Let it through, we'll check after parsing
  const size = parseInt(contentLength, 10);
  if (isNaN(size)) return null;
  if (size > maxSize) {
    return `Payload too large. Maximum size is ${Math.round(maxSize / 1024)}KB`;
  }
  return null;
}

// Sanitize and validate text input
export function sanitizeTextInput(text: string, maxLength: number): string {
  if (!text || typeof text !== 'string') return '';
  // Trim whitespace and limit length
  return text.trim().slice(0, maxLength);
}

// Log AI call for monitoring (uses service role to bypass RLS)
export async function logAICall(params: {
  userId: string;
  functionName: string;
  tokensInput?: number;
  tokensOutput?: number;
  estimatedCost?: number;
  status: 'success' | 'error' | 'rate_limited' | 'quota_exceeded';
  errorMessage?: string;
}) {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const serviceClient = createClient(supabaseUrl, serviceKey);
    
    await serviceClient.from('ai_call_logs').insert({
      user_id: params.userId,
      function_name: params.functionName,
      tokens_input: params.tokensInput || null,
      tokens_output: params.tokensOutput || null,
      estimated_cost: params.estimatedCost || null,
      status: params.status,
      error_message: params.errorMessage || null,
    });
  } catch (error) {
    // Don't fail the request if logging fails, just log to console
    console.error('Failed to log AI call:', error);
  }
}

// Authenticate user from request
export async function authenticateUser(req: Request): Promise<{ user: any; supabase: any } | Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return unauthorizedResponse('No authorization header');
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    console.error('Auth error:', userError);
    return unauthorizedResponse('Invalid or expired token');
  }

  return { user, supabase };
}

// Check AI rate limit using database function
export async function checkAIRateLimit(supabase: any, userId: string): Promise<{ allowed: boolean; error?: string; waitSeconds?: number }> {
  const { data: limitCheck, error: limitError } = await supabase.rpc('check_ai_rate_limit', {
    p_user_id: userId
  });

  if (limitError) {
    console.error('Rate limit check error:', limitError);
    return { allowed: false, error: 'Failed to check rate limit' };
  }

  if (!limitCheck?.allowed) {
    return { 
      allowed: false, 
      error: limitCheck?.message || 'Rate limit exceeded',
      waitSeconds: limitCheck?.wait_seconds
    };
  }

  return { allowed: true };
}
