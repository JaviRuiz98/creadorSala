-- 0014_observation_marks_unattended.sql
-- Guardar una observación vuelve la mesa/reservado a pendiente (rojo).

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
         attended = false,
         updated_at = now()
   where id = p_table_id;
end;
$$;

revoke all on function public.set_table_observation(uuid, text) from public;
grant execute on function public.set_table_observation(uuid, text) to authenticated;

-- Realtime debe poder comparar el valor anterior de observation.
alter table public.tables replica identity full;

notify pgrst, 'reload schema';
