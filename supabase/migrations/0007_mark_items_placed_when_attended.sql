-- Al marcar una mesa/reservado como atendido, sus productos pendientes pasan a PLACED.
create or replace function public.set_table_attended(p_table_id uuid,p_attended boolean)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if auth.uid() is null or public.current_role() not in ('ADMIN','USER') then
    raise exception 'No autorizado';
  end if;

  update public.tables
  set attended=p_attended, updated_at=now()
  where id=p_table_id;

  if p_attended then
    update public.order_items oi
    set status='PLACED',
        placed_by=auth.uid(),
        placed_at=now(),
        updated_at=now()
    from public.orders o
    where oi.order_id=o.id
      and o.table_id=p_table_id
      and oi.status='PENDING';
  end if;
end
$$;

revoke all on function public.set_table_attended(uuid,boolean) from public;
grant execute on function public.set_table_attended(uuid,boolean) to authenticated;
notify pgrst, 'reload schema';
