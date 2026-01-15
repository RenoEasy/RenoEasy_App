// ============================================================================
// SHARED CORS CONFIGURATION
// Used by all Supabase Edge Functions
// ============================================================================

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // In production, replace with your Vercel domain
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};
