-- Usuario visible para la aplicación. Supabase Auth continúa usando internamente
-- un email técnico generado por la Edge Function create-user.
alter table public.profiles
  add column if not exists username text;

-- Normalizamos cualquier valor que pudiera haberse añadido manualmente.
update public.profiles
set username = lower(trim(username))
where username is not null;

create unique index if not exists profiles_username_unique
  on public.profiles (lower(username))
  where username is not null;

comment on column public.profiles.username is
  'Nombre de usuario de acceso visible. Las cuentas creadas desde la aplicación usan un email técnico interno en Supabase Auth.';

notify pgrst, 'reload schema';
