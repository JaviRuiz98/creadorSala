-- Seguridad de altas: los metadatos del cliente nunca conceden privilegios.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles(id, full_name, role)
  values(new.id, new.raw_user_meta_data->>'full_name', 'WAITER');
  return new;
end
$$;

-- Almacén genérico de secretos internos. Solo se guarda el hash.
create table if not exists public.app_secrets (
  id uuid primary key default gen_random_uuid(),
  secret_key text not null unique,
  description text,
  secret_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_secrets enable row level security;
revoke all on table public.app_secrets from anon, authenticated;

create or replace function public.verify_app_secret(p_key text, p_secret text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  stored_hash text;
begin
  if auth.uid() is null or public.current_role() <> 'ADMIN' then
    return false;
  end if;

  select secret_hash into stored_hash
  from public.app_secrets
  where secret_key = p_key;

  if stored_hash is null then
    return false;
  end if;

  return stored_hash = crypt(p_secret, stored_hash);
end
$$;

revoke all on function public.verify_app_secret(text, text) from public;
grant execute on function public.verify_app_secret(text, text) to authenticated;
