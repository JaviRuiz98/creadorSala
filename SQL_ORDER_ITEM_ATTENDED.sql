-- 0013 - Estado atendido por línea de producto y conservación del histórico servido.
begin;

alter table public.order_items
  add column if not exists attended boolean;

-- Compatibilidad con los datos ya existentes:
-- todo lo que ya estaba PLACED se considera atendido; el resto, no atendido.
update public.order_items
set attended = (status = 'PLACED')
where attended is null;

alter table public.order_items
  alter column attended set default false,
  alter column attended set not null;

-- Al marcar una mesa/reservado como atendida, SOLO el pedido actual pasa a atendido.
-- El histórico atendido permanece intacto y volver a poner la mesa a false no lo revierte.
create or replace function public.set_table_attended(
  p_table_id uuid,
  p_attended boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.current_role() not in ('ADMIN','USER') then
    raise exception 'No autorizado';
  end if;

  update public.tables
     set attended = p_attended,
         updated_at = now()
   where id = p_table_id;

  if p_attended then
    update public.order_items oi
       set status = 'PLACED',
           attended = true,
           placed_by = auth.uid(),
           placed_at = coalesce(oi.placed_at, now()),
           updated_at = now()
      from public.orders o
     where oi.order_id = o.id
       and o.table_id = p_table_id
       and o.status = 'OPEN'
       and oi.status = 'PENDING'
       and oi.attended = false;
  end if;
end
$$;

revoke all on function public.set_table_attended(uuid,boolean) from public;
grant execute on function public.set_table_attended(uuid,boolean) to authenticated;

-- Al añadir productos nunca se modifica una línea que ya fue atendida.
-- Si existe una línea PENDING del mismo producto se acumula en ella;
-- si el producto ya fue servido, se crea una nueva línea PENDING independiente.
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
       and status = 'PENDING'
       and attended = false
     order by created_at desc
     limit 1;

    if v_order_item_id is not null then
      update public.order_items
         set quantity = quantity + v_quantity,
             updated_at = now()
       where id = v_order_item_id;
    else
      insert into public.order_items(
        order_id,
        product_id,
        quantity,
        status,
        attended,
        created_by
      )
      values(
        v_order_id,
        v_product_id,
        v_quantity,
        'PENDING',
        false,
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
commit;
