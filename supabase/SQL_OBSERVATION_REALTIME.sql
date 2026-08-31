-- Activa old-record completo en Realtime para public.tables.
-- Permite avisar al USER solo cuando cambia la observación y no ante
-- cualquier actualización de attended/updated_at.
alter table public.tables replica identity full;
