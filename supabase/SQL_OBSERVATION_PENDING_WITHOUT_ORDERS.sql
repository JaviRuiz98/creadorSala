-- 0016_observation_pending_without_orders.sql
-- Una observación no vacía debe dejar la mesa/reservado pendiente aunque no exista ningún pedido.

create or replace function public.set_table_observation(
  p_table_id uuid,
  p_observation text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_observation text := nullif(btrim(p_observation), '');
begin
  if auth.uid() is null or public.current_role() <> 'ADMIN' then
    raise exception 'No autorizado';
  end if;

  if not exists (select 1 from public.tables where id = p_table_id) then
    raise exception 'Mesa o reservado no encontrado';
  end if;

  update public.tables
     set observation = v_observation,
         attended = case when v_observation is not null then false else attended end,
         updated_at = now()
   where id = p_table_id;
end;
$$;

revoke all on function public.set_table_observation(uuid, text) from public;
grant execute on function public.set_table_observation(uuid, text) to authenticated;

alter table public.tables replica identity full;
notify pgrst, 'reload schema';
