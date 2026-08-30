-- Al añadir un producto a una mesa, incluso si ese producto ya estaba servido,
-- la nueva petición debe quedar pendiente y la mesa debe volver a attended=false.
create or replace function public.assign_products_to_table(
  p_table_id uuid,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_item jsonb;
  v_product_id uuid;
  v_quantity integer;
  v_order_item_id uuid;
begin
  if auth.uid() is null or public.current_role() <> 'ADMIN' then
    raise exception 'No autorizado';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Sin productos';
  end if;

  if not exists(select 1 from public.tables where id = p_table_id) then
    raise exception 'Mesa no encontrada';
  end if;

  select id
    into v_order_id
    from public.orders
   where table_id = p_table_id
     and status = 'OPEN'
   order by created_at desc
   limit 1;

  if v_order_id is null then
    insert into public.orders(table_id, created_by)
    values(p_table_id, auth.uid())
    returning id into v_order_id;
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity := (v_item->>'quantity')::integer;

    if v_quantity is null or v_quantity <= 0 then
      continue;
    end if;

    v_order_item_id := null;

    select id
      into v_order_item_id
      from public.order_items
     where order_id = v_order_id
       and product_id = v_product_id
       and status <> 'CANCELLED'
     order by
       case when status = 'PENDING' then 0 else 1 end,
       created_at desc
     limit 1;

    if v_order_item_id is not null then
      update public.order_items
         set quantity = quantity + v_quantity,
             status = 'PENDING',
             placed_by = null,
             placed_at = null,
             updated_at = now()
       where id = v_order_item_id;
    else
      insert into public.order_items(
        order_id,
        product_id,
        quantity,
        status,
        created_by
      )
      values(
        v_order_id,
        v_product_id,
        v_quantity,
        'PENDING',
        auth.uid()
      );
    end if;
  end loop;

  update public.tables
     set attended = false,
         updated_at = now()
   where id = p_table_id;

  return v_order_id;
end
$$;

revoke all on function public.assign_products_to_table(uuid,jsonb) from public;
grant execute on function public.assign_products_to_table(uuid,jsonb) to authenticated;
notify pgrst, 'reload schema';
