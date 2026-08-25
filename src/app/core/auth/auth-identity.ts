export const INTERNAL_AUTH_DOMAIN = 'usuarios.salachocolatte.app';

export function normalizeUsername(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/\.{2,}/g, '.')
    .replace(/^[._-]+|[._-]+$/g, '');
}

export function isValidUsername(value: string): boolean {
  return /^[a-z0-9][a-z0-9._-]{2,31}$/.test(normalizeUsername(value));
}

export function usernameToInternalEmail(value: string): string {
  return `${normalizeUsername(value)}@${INTERNAL_AUTH_DOMAIN}`;
}
