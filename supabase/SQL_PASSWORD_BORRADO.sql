-- Ejecuta este bloque DESPUÉS de 0004_admin_user_permissions_lock_delete.sql
-- Sustituye TU_CONTRASENA_DE_BORRADO por la contraseña que quieras usar.

insert into public.app_secrets (secret_key, description, secret_hash)
values (
  'table_deletion',
  'Autorización para eliminar mesas y reservados',
  crypt('TU_CONTRASENA_DE_BORRADO', gen_salt('bf'))
)
on conflict (secret_key)
do update set
  secret_hash = crypt('TU_CONTRASENA_DE_BORRADO', gen_salt('bf')),
  description = excluded.description,
  updated_at = now();
