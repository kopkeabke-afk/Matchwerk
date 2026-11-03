import type { Backend } from './backend';
import { createDemoBackend } from './demo-backend';
import { createSupabaseBackend } from './supabase-backend';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** Uses Supabase when configured (.env), otherwise a fully working offline demo. */
export const backend: Backend = url && key ? createSupabaseBackend(url, key) : createDemoBackend();
