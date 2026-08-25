import { Injectable, signal } from '@angular/core';
import type { Session, User } from '@supabase/supabase-js';
import { SupabaseService } from '../services/supabase.service';
import { ErrorMessageService } from '../services/error-message.service';
import type { Profile, Role } from '../models/models';
import { usernameToInternalEmail } from './auth-identity';

@Injectable({providedIn:'root'})
export class AuthService {
  readonly session = signal<Session | null>(null);
  readonly profile = signal<Profile | null>(null);
  readonly ready = signal(false);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly errors: ErrorMessageService,
  ) {
    if (!supabase.configured) { this.ready.set(true); return; }
    void this.init();
    supabase.client.auth.onAuthStateChange((_event, session) => {
      this.session.set(session);
      if (session?.user) void this.loadProfile(session.user);
      else this.profile.set(null);
    });
  }

  private async init(): Promise<void> {
    const { data } = await this.supabase.client.auth.getSession();
    this.session.set(data.session);
    if (data.session?.user) await this.loadProfile(data.session.user);
    this.ready.set(true);
  }

  private async loadProfile(user: User): Promise<void> {
    const { data } = await this.supabase.client.from('profiles').select('*').eq('id', user.id).maybeSingle();
    this.profile.set(data as Profile | null);
  }

  async signIn(identifier: string, password: string): Promise<void> {
    const cleanIdentifier = identifier.trim();
    const email = cleanIdentifier.includes('@')
      ? cleanIdentifier.toLowerCase()
      : usernameToInternalEmail(cleanIdentifier);

    const { error } = await this.supabase.client.auth.signInWithPassword({ email, password });
    if (error) throw new Error(this.errors.humanize(error, 'No se pudo iniciar sesión'));
  }

  async signOut(): Promise<void> {
    const {error}=await this.supabase.client.auth.signOut();
    if(error) throw error;
  }

  async whenReady(): Promise<void> {
    if (this.ready()) return;
    await new Promise<void>(resolve => {
      const timer = window.setInterval(() => {
        if (this.ready()) {
          window.clearInterval(timer);
          resolve();
        }
      }, 10);
    });
  }

  hasRole(...roles: Role[]): boolean {
    const role=this.profile()?.role;
    return !!role && roles.includes(role);
  }
}
