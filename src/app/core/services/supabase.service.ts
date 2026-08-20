import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import type { Database } from '../data/database.types';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly client: SupabaseClient<Database>;
  readonly configured: boolean;
  constructor() { this.configured = Boolean(environment.supabaseUrl && environment.supabaseAnonKey); this.client = createClient<Database>(environment.supabaseUrl || 'https://placeholder.supabase.co', environment.supabaseAnonKey || 'placeholder-anon-key', { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }); }
}
