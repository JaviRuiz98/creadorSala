import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { ErrorMessageService } from './error-message.service';
import type { Role } from '../models/models';

export interface CreateUserRequest {
  full_name: string;
  username: string;
  password: string;
  role: Role;
  admin_password: string;
}

@Injectable({ providedIn: 'root' })
export class UserAdminService {
  constructor(
    private readonly db: SupabaseService,
    private readonly errors: ErrorMessageService,
  ) {}

  async verifyAccess(password: string): Promise<boolean> {
    const { data, error } = await this.db.client.rpc('verify_app_secret', {
      p_key: 'user_management',
      p_secret: password,
    });

    if (error) throw new Error(this.errors.humanize(error, 'No se pudo verificar la contraseña'));
    return data === true;
  }

  async createUser(request: CreateUserRequest): Promise<void> {
    const {
      data: { session },
    } = await this.db.client.auth.getSession();

    if (!session?.access_token) {
      throw new Error('La sesión ha caducado. Cierra sesión y vuelve a entrar.');
    }

    const { data, error } = await this.db.client.functions.invoke('create-user', {
      body: request,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (error) {
      let detail = error.message;
      const context = (error as { context?: Response }).context;
      if (context && typeof context.clone === 'function') {
        try {
          const payload = await context.clone().json() as { error?: string; message?: string; detail?: string };
          detail = payload.error ?? payload.message ?? payload.detail ?? detail;
        } catch {
          // Conservamos el mensaje original si la respuesta no es JSON.
        }
      }
      const normalized = detail.toLowerCase();
      if (normalized.includes('faltan datos obligatorios') || normalized.includes('completa todos los campos obligatorios')) {
        throw new Error(
          'La función create-user desplegada en Supabase está desactualizada. Actualízala con supabase/functions/create-user/index.ts de este proyecto.',
        );
      }
      throw new Error(this.errors.humanize(detail, 'No se pudo crear el usuario'));
    }

    if (data?.error) {
      throw new Error(this.errors.humanize(data.error, 'No se pudo crear el usuario'));
    }

    if (!data?.success) {
      throw new Error('El servidor no confirmó la creación del usuario.');
    }
  }
}
