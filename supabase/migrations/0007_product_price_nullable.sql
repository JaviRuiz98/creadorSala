-- El precio queda reservado para un desarrollo futuro.
-- En la interfaz actual no se solicita ni se muestra.

alter table public.products
  alter column price drop not null,
  alter column price drop default;

comment on column public.products.price is
  'Reservado para futuro desarrollo. Actualmente puede ser NULL y no se usa en la interfaz.';
