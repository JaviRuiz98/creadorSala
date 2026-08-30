-- Gestión segura de productos y categorías.
-- Impide eliminar elementos que hayan sido utilizados en pedidos.

create or replace function public.product_has_order_history(p_product_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Solo ADMIN puede gestionar el catálogo';
  end if;
  return exists(select 1 from public.order_items oi where oi.product_id = p_product_id);
end;
$$;

create or replace function public.category_has_order_history(p_category_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Solo ADMIN puede gestionar el catálogo';
  end if;
  return exists(
    select 1
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    where p.category_id = p_category_id
  );
end;
$$;

create or replace function public.delete_product_safe(p_product_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Solo ADMIN puede gestionar el catálogo';
  end if;
  if exists(select 1 from public.order_items oi where oi.product_id = p_product_id) then
    return false;
  end if;
  delete from public.products where id = p_product_id;
  return found;
end;
$$;

create or replace function public.delete_category_safe(p_category_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Solo ADMIN puede gestionar el catálogo';
  end if;
  if exists(
    select 1
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    where p.category_id = p_category_id
  ) then
    return false;
  end if;
  delete from public.products where category_id = p_category_id;
  delete from public.product_categories where id = p_category_id;
  return found;
end;
$$;

revoke all on function public.product_has_order_history(uuid) from public;
revoke all on function public.category_has_order_history(uuid) from public;
revoke all on function public.delete_product_safe(uuid) from public;
revoke all on function public.delete_category_safe(uuid) from public;
grant execute on function public.product_has_order_history(uuid) to authenticated;
grant execute on function public.category_has_order_history(uuid) to authenticated;
grant execute on function public.delete_product_safe(uuid) to authenticated;
grant execute on function public.delete_category_safe(uuid) to authenticated;
notify pgrst, 'reload schema';
