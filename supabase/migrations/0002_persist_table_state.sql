-- 0002_persist_table_state.sql
--
-- Corrige varios problemas de persistencia detectados:
--
-- 1) La tabla "tables" no tenía columnas "type" ni "attended", aunque el
--    frontend y los tipos de Supabase ya las esperaban. Como
--    replace_floor_plan_snapshot() no las guardaba, cada vez que se
--    guardaba el plano los reservados "perdían" su tipo y el estado de
--    "atendida" nunca llegaba a persistirse.
--
-- 2) replace_floor_plan_snapshot() borraba TODAS las mesas del plano y
--    las volvía a insertar con id nuevo en cada guardado. Eso rompía la
--    referencia con "orders.table_id" (sin ON DELETE CASCADE), por lo que
--    cualquier guardado de un plano con pedidos abiertos fallaba en
--    silencio: no se guardaba nada, ni siquiera los borrados de mesas.
--
-- 3) El enum floor_element_kind no incluía 'text', pero el editor guarda
--    elementos de texto: cualquier plano con un texto hacía fallar todo
--    el guardado (incluida la eliminación de mesas/reservados).

alter type public.floor_element_kind rename to floor_element_kind_old;
create type public.floor_element_kind as enum ('wall','zone','door','text');
alter table public.floor_plan_elements
  alter column kind type public.floor_element_kind
  using kind::text::public.floor_element_kind;
drop type public.floor_element_kind_old;

create type public.table_type as enum ('TABLE','RESERVED');

alter table public.tables
  add column if not exists type public.table_type not null default 'TABLE';

alter table public.tables
  add column if not exists attended boolean not null default false;

-- Permite borrar una mesa/reservado de verdad: sus pedidos abiertos
-- (y las líneas de pedido, que ya cascadean desde "orders") se
-- eliminan con ella en lugar de bloquear el borrado.
alter table public.orders
  drop constraint if exists orders_table_id_fkey;
alter table public.orders
  add constraint orders_table_id_fkey
  foreign key (table_id) references public.tables(id) on delete cascade;

create or replace function public.replace_floor_plan_snapshot(
  p_floor_plan_id uuid,
  p_elements jsonb,
  p_tables jsonb
) returns void
language plpgsql
security invoker
as $$
declare
  keep_ids uuid[];
begin
  -- Los elementos del plano (paredes, zonas, textos...) no tienen
  -- dependencias externas: se pueden reemplazar sin problema.
  delete from public.floor_plan_elements where floor_plan_id = p_floor_plan_id;

  insert into public.floor_plan_elements(
    floor_plan_id, kind, x, y, width, height, rotation, points, label, z_index
  )
  select
    p_floor_plan_id,
    (e->>'kind')::public.floor_element_kind,
    (e->>'x')::numeric,
    (e->>'y')::numeric,
    (e->>'width')::numeric,
    (e->>'height')::numeric,
    (e->>'rotation')::numeric,
    e->'points',
    e->>'label',
    (e->>'z_index')::integer
  from jsonb_array_elements(p_elements) e;

  -- Mesas y reservados SÍ tienen dependencias (pedidos), así que se
  -- actualizan por id en vez de borrar+recrear todo:
  --  - las que ya no vienen en el snapshot se borran de verdad.
  --  - las que se mantienen conservan su id (y por tanto sus pedidos).
  --  - las nuevas se insertan con el id que haya generado el cliente.
  select array_agg((t->>'id')::uuid)
    into keep_ids
  from jsonb_array_elements(p_tables) t
  where (t->>'id') is not null;

  delete from public.tables
  where floor_plan_id = p_floor_plan_id
    and (keep_ids is null or not (id = any(keep_ids)));

  insert into public.tables(
    id, floor_plan_id, type, number, x, y, width, height, rotation, shape, attended
  )
  select
    coalesce((t->>'id')::uuid, gen_random_uuid()),
    p_floor_plan_id,
    coalesce((t->>'type')::public.table_type, 'TABLE'),
    (t->>'number')::integer,
    (t->>'x')::numeric,
    (t->>'y')::numeric,
    (t->>'width')::numeric,
    (t->>'height')::numeric,
    (t->>'rotation')::numeric,
    (t->>'shape')::public.table_shape,
    coalesce((t->>'attended')::boolean, false)
  from jsonb_array_elements(p_tables) t
  on conflict (id) do update set
    floor_plan_id = excluded.floor_plan_id,
    type = excluded.type,
    number = excluded.number,
    x = excluded.x,
    y = excluded.y,
    width = excluded.width,
    height = excluded.height,
    rotation = excluded.rotation,
    shape = excluded.shape,
    attended = excluded.attended,
    updated_at = now();
end
$$;
