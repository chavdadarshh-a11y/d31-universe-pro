import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env, isLive } from './env'

export const supabase: SupabaseClient | null = isLive
  ? createClient(env.supabaseUrl, env.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' } })
  : null
