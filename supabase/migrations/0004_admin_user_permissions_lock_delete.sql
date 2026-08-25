-- 0004_admin_user_permissions_lock_delete.sql
-- Roles ADMIN/USER, permisos RLS, Realtime operativo, bloqueo persistente,
-- asignación transaccional de productos y borrado protegido de mesas.

-- 0) Eliminar primero políticas que dependen de is_manager/current_role.
drop policy if exists profiles_self_select on public.profiles;
drop policy if exists profiles_manager_update on public.profiles;
drop policy if exists profiles_self_or_admin_select on public.profiles;
drop policy if exists profiles_admin_update on public.profiles;
drop policy if exists plans_auth_select on public.floor_plans;
drop policy if exists plans_manager_insert on public.floor_plans;
drop policy if exists plans_manager_update on public.floor_plans;
drop policy if exists plans_manager_delete on public.floor_plans;
drop policy if exists plans_admin_insert on public.floor_plans;
drop policy if exists plans_admin_update on public.floor_plans;
drop policy if exists plans_admin_delete on public.floor_plans;
drop policy if exists elements_auth_select on public.floor_plan_elements;
drop policy if exists elements_manager_write on public.floor_plan_elements;
drop policy if exists elements_admin_write on public.floor_plan_elements;
drop policy if exists tables_auth_select on public.tables;
drop policy if exists tables_manager_write on public.tables;
drop policy if exists tables_admin_write on public.tables;
drop policy if exists categories_auth_select on public.product_categories;
drop policy if exists categories_manager_write on public.product_categories;
drop policy if exists categories_admin_write on public.product_categories;
drop policy if exists products_auth_select on public.products;
drop policy if exists products_manager_write on public.products;
drop policy if exists products_admin_write on public.products;
drop policy if exists orders_auth_select on public.orders;
drop policy if exists orders_auth_insert on public.orders;
drop policy if exists orders_manager_update on public.orders;
drop policy if exists orders_manager_delete on public.orders;
drop policy if exists orders_admin_insert on public.orders;
drop policy if exists orders_admin_update on public.orders;
drop policy if exists orders_admin_delete on public.orders;
drop policy if exists items_auth_select on public.order_items;
drop policy if exists items_auth_insert on public.order_items;
drop policy if exists items_update_own_or_manager on public.order_items;
drop policy if exists items_manager_delete on public.order_items;
drop policy if exists items_admin_insert on public.order_items;
drop policy if exists items_admin_update on public.order_items;
drop policy if exists items_admin_delete on public.order_items;

-- La tabla reservations existía en algunas instalaciones anteriores y puede
-- conservar políticas que dependen de is_manager(). Se limpian solo si existe.
do $$
begin
  if to_regclass('public.reservations') is not null then
    execute 'drop policy if exists reservations_auth_select on public.reservations';
    execute 'drop policy if exists reservations_auth_insert on public.reservations';
    execute 'drop policy if exists reservations_update on public.reservations';
    execute 'drop policy if exists reservations_manager_delete on public.reservations';
    execute 'drop policy if exists reservations_manager_write on public.reservations';
    execute 'drop policy if exists reservations_admin_insert on public.reservations';
    execute 'drop policy if exists reservations_admin_update on public.reservations';
    execute 'drop policy if exists reservations_admin_delete on public.reservations';
    execute 'drop policy if exists reservations_admin_write on public.reservations';
  end if;
end
$$;

-- 1) Simplificar roles. Todos los roles antiguos no ADMIN pasan a USER.
alter table public.profiles alter column role drop default;
drop function if exists public.verify_app_secret(text, text);
drop function if exists public.is_admin();
drop function if exists public.is_manager();
drop function if exists public.current_role();

alter type public.app_role rename to app_role_old;
create type public.app_role as enum ('ADMIN','USER');
alter table public.profiles
  alter column role type public.app_role
  using (case when role::text='ADMIN' then 'ADMIN' else 'USER' end)::public.app_role;
alter table public.profiles alter column role set default 'USER';
drop type public.app_role_old;

create or replace function public.current_role()
returns public.app_role
language sql stable security definer set search_path=public
as $$ select role from public.profiles where id=auth.uid() $$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path=public
as $$ select public.current_role()='ADMIN' $$;

-- Alias conservado por compatibilidad con migraciones/código anterior.
create or replace function public.is_manager()
returns boolean
language sql stable security definer set search_path=public
as $$ select public.is_admin() $$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path=public
as $$
begin
  insert into public.profiles(id,full_name,role)
  values(new.id,new.raw_user_meta_data->>'full_name','USER');
  return new;
end
$$;

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

-- 2) Bloqueo persistente del diseño.
alter table public.floor_plans add column if not exists is_locked boolean not null default false;

-- 3) Políticas: USER solo lectura general; ADMIN gestiona todo.
create policy profiles_self_or_admin_select on public.profiles
for select to authenticated using(id=auth.uid() or public.is_admin());
create policy profiles_admin_update on public.profiles
for update to authenticated using(public.is_admin()) with check(public.is_admin());

create policy plans_auth_select on public.floor_plans for select to authenticated using(true);
create policy plans_admin_insert on public.floor_plans for insert to authenticated with check(public.is_admin() and created_by=auth.uid());
create policy plans_admin_update on public.floor_plans for update to authenticated using(public.is_admin()) with check(public.is_admin());
create policy plans_admin_delete on public.floor_plans for delete to authenticated using(public.is_admin());

create policy elements_auth_select on public.floor_plan_elements for select to authenticated using(true);
create policy elements_admin_write on public.floor_plan_elements for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy tables_auth_select on public.tables for select to authenticated using(true);
create policy tables_admin_write on public.tables for all to authenticated using(public.is_admin()) with check(public.is_admin());
do $$
begin
  if to_regclass('public.reservations') is not null then
    execute 'create policy reservations_auth_select on public.reservations for select to authenticated using(true)';
    execute 'create policy reservations_admin_write on public.reservations for all to authenticated using(public.is_admin()) with check(public.is_admin())';
  end if;
end
$$;
create policy categories_auth_select on public.product_categories for select to authenticated using(true);
create policy categories_admin_write on public.product_categories for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy products_auth_select on public.products for select to authenticated using(true);
create policy products_admin_write on public.products for all to authenticated using(public.is_admin()) with check(public.is_admin());

create policy orders_auth_select on public.orders for select to authenticated using(true);
create policy orders_admin_insert on public.orders for insert to authenticated with check(public.is_admin() and created_by=auth.uid());
create policy orders_admin_update on public.orders for update to authenticated using(public.is_admin()) with check(public.is_admin());
create policy orders_admin_delete on public.orders for delete to authenticated using(public.is_admin());
create policy items_auth_select on public.order_items for select to authenticated using(true);
create policy items_admin_insert on public.order_items for insert to authenticated with check(public.is_admin() and created_by=auth.uid());
create policy items_admin_update on public.order_items for update to authenticated using(public.is_admin()) with check(public.is_admin());
create policy items_admin_delete on public.order_items for delete to authenticated using(public.is_admin());

-- 4) USER/ADMIN pueden cambiar SOLO el estado attended mediante RPC.
create or replace function public.set_table_attended(p_table_id uuid,p_attended boolean)
returns void
language plpgsql security definer set search_path=public
as $$
begin
  if auth.uid() is null or public.current_role() not in ('ADMIN','USER') then
    raise exception 'No autorizado';
  end if;
  update public.tables set attended=p_attended,updated_at=now() where id=p_table_id;
end
$$;
revoke all on function public.set_table_attended(uuid,boolean) from public;
grant execute on function public.set_table_attended(uuid,boolean) to authenticated;

-- 5) Crear/obtener pedido y asignar productos en una sola transacción.
create or replace function public.assign_products_to_table(p_table_id uuid,p_items jsonb)
returns uuid
language plpgsql security definer set search_path=public
as $$
declare
  v_order_id uuid;
  v_item jsonb;
  v_product_id uuid;
  v_quantity integer;
begin
  if auth.uid() is null or public.current_role()<>'ADMIN' then raise exception 'No autorizado'; end if;
  if p_items is null or jsonb_array_length(p_items)=0 then raise exception 'Sin productos'; end if;
  if not exists(select 1 from public.tables where id=p_table_id) then raise exception 'Mesa no encontrada'; end if;

  select id into v_order_id from public.orders where table_id=p_table_id and status='OPEN' order by created_at desc limit 1;
  if v_order_id is null then
    insert into public.orders(table_id,created_by) values(p_table_id,auth.uid()) returning id into v_order_id;
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id=(v_item->>'product_id')::uuid;
    v_quantity=(v_item->>'quantity')::integer;
    if v_quantity is null or v_quantity<=0 then continue; end if;

    if exists(select 1 from public.order_items where order_id=v_order_id and product_id=v_product_id and status<>'CANCELLED') then
      update public.order_items
         set quantity=quantity+v_quantity,updated_at=now()
       where order_id=v_order_id and product_id=v_product_id and status<>'CANCELLED';
    else
      insert into public.order_items(order_id,product_id,quantity,created_by)
      values(v_order_id,v_product_id,v_quantity,auth.uid());
    end if;
  end loop;

  update public.tables set attended=false,updated_at=now() where id=p_table_id;
  return v_order_id;
end
$$;
revoke all on function public.assign_products_to_table(uuid,jsonb) from public;
grant execute on function public.assign_products_to_table(uuid,jsonb) to authenticated;

-- 6) Borrado protegido. Siempre requiere secreto table_deletion.
-- Si hay productos y attended=true, la primera llamada devuelve SERVED_PRODUCTS;
-- la UI muestra el aviso alarmista y solo una segunda llamada con p_force=true borra.
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
