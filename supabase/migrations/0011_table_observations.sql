-- 0011_table_observations.sql
-- Observaciones por mesa/reservado: lectura para usuarios autenticados, escritura solo ADMIN.

alter table public.tables
  add column if not exists observation text null;

comment on column public.tables.observation is
  'Observación operativa visible al personal USER y editable únicamente por ADMIN.';

create or replace function public.set_table_observation(
  p_table_id uuid,
  p_observation text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.current_role() <> 'ADMIN' then
    raise exception 'No autorizado';
  end if;

  if not exists (select 1 from public.tables where id = p_table_id) then
    raise exception 'Mesa o reservado no encontrado';
  end if;

  update public.tables
     set observation = nullif(btrim(p_observation), ''),
         updated_at = now()
   where id = p_table_id;
end;
$$;

revoke all on function public.set_table_observation(uuid, text) from public;
grant execute on function public.set_table_observation(uuid, text) to authenticated;

notify pgrst, 'reload schema';

-- Necesario para que Realtime entregue el valor anterior de observation
-- y el cliente USER pueda distinguir un cambio de observación de otros
-- UPDATE sobre la mesa (attended, updated_at, etc.).
alter table public.tables replica identity full;
