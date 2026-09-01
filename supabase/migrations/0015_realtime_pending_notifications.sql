-- 0015_realtime_pending_notifications.sql
-- Refuerza los eventos necesarios para avisos USER de pedidos y observaciones.

-- Necesitamos OLD completo en UPDATE de mesas para distinguir observación y estado.
alter table public.tables replica identity full;
alter table public.order_items replica identity full;

-- Añade las tablas a supabase_realtime solo si todavía no están publicadas.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tables'
  ) then
    alter publication supabase_realtime add table public.tables;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'order_items'
  ) then
    alter publication supabase_realtime add table public.order_items;
  end if;
end $$;
