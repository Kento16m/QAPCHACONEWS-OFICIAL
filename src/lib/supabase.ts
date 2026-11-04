import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const normalizeSupabaseUrl = (value?: string) => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.replace(/\/+$/, "").replace(/\/rest\/v1$/, "");
};

const supabaseUrl = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL);
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export function requireSupabaseClient() {
  if (!supabase) {
    throw new Error("Falta configurar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY. La URL debe ser la del proyecto de Supabase y no la URL /rest/v1.");
  }
  return supabase;
}
