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

  private readonly sessionStartedAtKey = 'creadorSala.sessionStartedAt';
  private readonly maxSessionDurationMs = 12 * 60 * 60 * 1000;
  private expiryTimer: number | null = null;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly errors: ErrorMessageService,
  ) {
    if (!supabase.configured) { this.ready.set(true); return; }

    void this.init();

    supabase.client.auth.onAuthStateChange((event, session) => {
      this.session.set(session);

      if (event === 'SIGNED_OUT' || !session?.user) {
        this.profile.set(null);
        this.clearSessionLifetime();
        return;
      }

      void this.loadProfile(session.user);
      this.scheduleSessionExpiry();
    });

    // Si el equipo permanece abierto/suspendido, al volver a la aplicación
    // se comprueba de nuevo el límite absoluto de 12 horas.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void this.enforceSessionLifetime();
    });
    window.addEventListener('focus', () => void this.enforceSessionLifetime());
  }

  private async init(): Promise<void> {
    const { data } = await this.supabase.client.auth.getSession();

    if (data.session && this.isSessionExpired()) {
      await this.forceExpiredSignOut();
      this.ready.set(true);
      return;
    }

    // Una sesión antigua creada antes de implantar el límite de 12 h no tiene
    // marca de inicio. Por seguridad se cierra y se exige iniciar sesión otra vez.
    if (data.session && !this.getSessionStartedAt()) {
      await this.forceExpiredSignOut();
      this.ready.set(true);
      return;
    }

    this.session.set(data.session);
    if (data.session?.user) {
      await this.loadProfile(data.session.user);
      this.scheduleSessionExpiry();
    }
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

    const { data, error } = await this.supabase.client.auth.signInWithPassword({ email, password });
    if (error) throw new Error(this.errors.humanize(error, 'No se pudo iniciar sesión'));

    if (!data.session) {
      throw new Error('Supabase no devolvió una sesión válida');
    }

    localStorage.setItem(this.sessionStartedAtKey, String(Date.now()));
    this.session.set(data.session);
    if (data.session.user) await this.loadProfile(data.session.user);
    this.scheduleSessionExpiry();
  }

  async signOut(): Promise<void> {
    this.clearSessionLifetime();
    const {error}=await this.supabase.client.auth.signOut();
    this.session.set(null);
    this.profile.set(null);
    if(error) throw error;
  }

  private getSessionStartedAt(): number | null {
    const raw = localStorage.getItem(this.sessionStartedAtKey);
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  private isSessionExpired(): boolean {
    const startedAt = this.getSessionStartedAt();
    if (!startedAt) return false;
    return Date.now() - startedAt >= this.maxSessionDurationMs;
  }

  private scheduleSessionExpiry(): void {
    if (this.expiryTimer !== null) {
      window.clearTimeout(this.expiryTimer);
      this.expiryTimer = null;
    }

    const startedAt = this.getSessionStartedAt();
    if (!startedAt || !this.session()) return;

    const remaining = this.maxSessionDurationMs - (Date.now() - startedAt);
    if (remaining <= 0) {
      void this.forceExpiredSignOut();
      return;
    }

    this.expiryTimer = window.setTimeout(() => {
      void this.forceExpiredSignOut();
    }, remaining);
  }

  private async enforceSessionLifetime(): Promise<void> {
    if (!this.session()) return;

    if (!this.getSessionStartedAt() || this.isSessionExpired()) {
      await this.forceExpiredSignOut();
      return;
    }

    this.scheduleSessionExpiry();
  }

  private async forceExpiredSignOut(): Promise<void> {
    this.clearSessionLifetime();
    try {
      await this.supabase.client.auth.signOut();
    } finally {
      this.session.set(null);
      this.profile.set(null);
    }
  }

  private clearSessionLifetime(): void {
    localStorage.removeItem(this.sessionStartedAtKey);
    if (this.expiryTimer !== null) {
      window.clearTimeout(this.expiryTimer);
      this.expiryTimer = null;
    }
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
