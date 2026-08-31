-- 0012_text_font_size.sql
-- Tamaño de fuente configurable para elementos de texto del plano.

alter table public.floor_plan_elements
  add column if not exists font_size integer null;

update public.floor_plan_elements
set font_size = 22
where kind::text = 'text'
  and font_size is null;

alter table public.floor_plan_elements
  add constraint floor_plan_elements_font_size_check
  check (font_size is null or (font_size >= 8 and font_size <= 120))
  not valid;

alter table public.floor_plan_elements
  validate constraint floor_plan_elements_font_size_check;

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
  delete from public.floor_plan_elements where floor_plan_id = p_floor_plan_id;

  insert into public.floor_plan_elements(
    floor_plan_id, kind, x, y, width, height, rotation, points, label, font_size, z_index
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
    case
      when e->>'kind' = 'text' then coalesce((e->>'font_size')::integer, 22)
      else null
    end,
    (e->>'z_index')::integer
  from jsonb_array_elements(p_elements) e;

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
