-- 0006: corregir pgcrypto en funciones de contrasenas protegidas.
-- En Supabase pgcrypto suele estar instalado en el esquema extensions.

create extension if not exists pgcrypto with schema extensions;

create or replace function public.verify_app_secret(p_key text,p_secret text)
returns boolean
language plpgsql stable security definer set search_path=public,extensions
as $$
declare v_hash text;
begin
  if auth.uid() is null or public.current_role()<>'ADMIN' then return false; end if;
  select secret_hash into v_hash from public.app_secrets where secret_key=p_key;
  if v_hash is null then return false; end if;
  return v_hash=extensions.crypt(p_secret,v_hash);
end
$$;

revoke all on function public.verify_app_secret(text,text) from public;
grant execute on function public.verify_app_secret(text,text) to authenticated;

create or replace function public.delete_table_with_orders(p_table_id uuid,p_secret text,p_force boolean default false)
returns jsonb
language plpgsql security definer set search_path=public,extensions
as $$
declare
  v_attended boolean;
  v_has_products boolean;
  v_hash text;
begin
  if auth.uid() is null or public.current_role()<>'ADMIN' then raise exception 'No autorizado'; end if;

  select secret_hash into v_hash from public.app_secrets where secret_key='table_deletion';
  if v_hash is null or v_hash<>extensions.crypt(p_secret,v_hash) then
    return jsonb_build_object('ok',false,'reason','BAD_PASSWORD');
  end if;

  select attended into v_attended from public.tables where id=p_table_id;
  if not found then return jsonb_build_object('ok',true,'reason','NOT_PERSISTED'); end if;

  select exists(
    select 1 from public.orders o join public.order_items oi on oi.order_id=o.id
    where o.table_id=p_table_id and oi.status<>'CANCELLED'
  ) into v_has_products;

  if v_has_products and coalesce(v_attended,false) and not p_force then
    return jsonb_build_object('ok',false,'reason','SERVED_PRODUCTS');
  end if;

  delete from public.tables where id=p_table_id;
  return jsonb_build_object('ok',true,'reason','DELETED');
end
$$;

revoke all on function public.delete_table_with_orders(uuid,text,boolean) from public;
grant execute on function public.delete_table_with_orders(uuid,text,boolean) to authenticated;

notify pgrst, 'reload schema';
