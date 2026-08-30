-- Permite eliminar productos/categorías si sus únicas referencias históricas están CANCELLED.
-- Bloquea si existe cualquier línea PENDING o PLACED.
-- Al borrar, elimina las líneas CANCELLED correspondientes y limpia pedidos que queden vacíos.

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

  return exists(
    select 1
    from public.order_items oi
    where oi.product_id = p_product_id
      and oi.status <> 'CANCELLED'::public.order_item_status
  );
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
      and oi.status <> 'CANCELLED'::public.order_item_status
  );
end;
$$;

create or replace function public.delete_product_safe(p_product_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deleted boolean := false;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Solo ADMIN puede gestionar el catálogo';
  end if;

  -- Cualquier referencia activa/servida impide borrar el producto.
  if exists(
    select 1
    from public.order_items oi
    where oi.product_id = p_product_id
      and oi.status <> 'CANCELLED'::public.order_item_status
  ) then
    return false;
  end if;

  -- Las únicas referencias posibles a estas alturas son canceladas: se purgan.
  delete from public.order_items
  where product_id = p_product_id
    and status = 'CANCELLED'::public.order_item_status;

  -- Si al purgar las líneas canceladas queda una comanda vacía, no aporta historial útil.
  delete from public.orders o
  where not exists (
    select 1 from public.order_items oi where oi.order_id = o.id
  );

  delete from public.products where id = p_product_id;
  v_deleted := found;

  return v_deleted;
end;
$$;

create or replace function public.delete_category_safe(p_category_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deleted boolean := false;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Solo ADMIN puede gestionar el catálogo';
  end if;

  -- Si cualquiera de sus productos tiene una línea activa/servida, se bloquea toda la categoría.
  if exists(
    select 1
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    where p.category_id = p_category_id
      and oi.status <> 'CANCELLED'::public.order_item_status
  ) then
    return false;
  end if;

  -- Purgar únicamente el historial cancelado de los productos de la categoría.
  delete from public.order_items oi
  using public.products p
  where oi.product_id = p.id
    and p.category_id = p_category_id
    and oi.status = 'CANCELLED'::public.order_item_status;

  delete from public.orders o
  where not exists (
    select 1 from public.order_items oi where oi.order_id = o.id
  );

  delete from public.products where category_id = p_category_id;
  delete from public.product_categories where id = p_category_id;
  v_deleted := found;

  return v_deleted;
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
