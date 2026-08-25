import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ErrorMessageService {
  humanize(value: unknown, fallback = 'Se ha producido un error'): string {
    const raw = this.extract(value).trim();
    const text = raw.toLowerCase();

    if (!raw) return fallback;
    if (text.includes('invalid login credentials')) return 'Usuario o contraseña incorrectos.';
    if (text.includes('unable to validate email address') || text.includes('invalid email') || text.includes('invalid format')) {
      return 'El nombre de usuario no tiene un formato válido.';
    }
    if (text.includes('already registered') || text.includes('already exists') || text.includes('duplicate')) {
      return 'Ese nombre de usuario ya existe.';
    }
    if (text.includes('password') && (text.includes('6') || text.includes('short'))) {
      return 'La contraseña debe tener al menos 6 caracteres.';
    }
    if (text.includes('contraseña de administración incorrecta')) return 'La contraseña de administración es incorrecta.';
    if (text.includes('sesión') || text.includes('jwt') || text.includes('unauthorized') || text.includes('invalid credentials')) {
      return 'La sesión ha caducado o no es válida. Cierra sesión y vuelve a entrar.';
    }
    if (text.includes('solo un admin') || text.includes('no autorizado') || text.includes('forbidden')) {
      return 'No tienes permisos para realizar esta operación.';
    }
    if (text.includes('failed to fetch') || text.includes('network') || text.includes('err_failed')) {
      return 'No se ha podido conectar con el servidor. Comprueba la conexión e inténtalo de nuevo.';
    }

    return raw || fallback;
  }

  private extract(value: unknown): string {
    if (value instanceof Error) return value.message;
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object') {
      const candidate = value as { error?: unknown; message?: unknown; detail?: unknown };
      if (typeof candidate.error === 'string') return candidate.error;
      if (typeof candidate.message === 'string') return candidate.message;
      if (typeof candidate.detail === 'string') return candidate.detail;
    }
    return '';
  }
}
