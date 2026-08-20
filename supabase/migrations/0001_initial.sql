create extension if not exists pgcrypto;
create type public.app_role as enum ('ADMIN','WAITER','BARTENDER','MANAGER');
create type public.table_shape as enum ('circle','rectangle');
create type public.floor_element_kind as enum ('wall','zone','door');
create type public.order_status as enum ('OPEN','CLOSED','CANCELLED');
create type public.order_item_status as enum ('PENDING','PLACED','CANCELLED');

create table public.profiles(id uuid primary key references auth.users(id) on delete cascade,full_name text,role public.app_role not null default 'WAITER',created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.floor_plans(id uuid primary key default gen_random_uuid(),name text not null,width integer not null default 2000 check(width between 500 and 10000),height integer not null default 1200 check(height between 500 and 10000),is_active boolean not null default false,created_by uuid not null references public.profiles(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.floor_plan_elements(id uuid primary key default gen_random_uuid(),floor_plan_id uuid not null references public.floor_plans(id) on delete cascade,kind public.floor_element_kind not null,x numeric not null,y numeric not null,width numeric not null default 0,height numeric not null default 0,rotation numeric not null default 0,points jsonb,label text,z_index integer not null default 0,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.tables(id uuid primary key default gen_random_uuid(),floor_plan_id uuid not null references public.floor_plans(id) on delete cascade,number integer not null check(number>0),x numeric not null,y numeric not null,width numeric not null default 100,height numeric not null default 100,rotation numeric not null default 0,shape public.table_shape not null default 'circle',created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(floor_plan_id,number));
create table public.product_categories(id uuid primary key default gen_random_uuid(),name text not null unique,sort_order integer not null default 0,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.products(id uuid primary key default gen_random_uuid(),category_id uuid not null references public.product_categories(id),name text not null,price numeric(10,2) not null default 0 check(price>=0),active boolean not null default true,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(category_id,name));
create table public.orders(id uuid primary key default gen_random_uuid(),table_id uuid not null references public.tables(id),created_by uuid not null references public.profiles(id),status public.order_status not null default 'OPEN',created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.order_items(id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders(id) on delete cascade,product_id uuid not null references public.products(id),quantity integer not null check(quantity>0),status public.order_item_status not null default 'PENDING',created_by uuid not null references public.profiles(id),placed_by uuid references public.profiles(id),placed_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create unique index one_open_order_per_table on public.orders(table_id) where status='OPEN';
create index idx_floor_elements_plan on public.floor_plan_elements(floor_plan_id,z_index);
create index idx_tables_plan on public.tables(floor_plan_id);
create index idx_products_category on public.products(category_id,active);
create index idx_orders_table_status on public.orders(table_id,status);
create index idx_order_items_order_status on public.order_items(order_id,status);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger floor_plans_updated before update on public.floor_plans for each row execute function public.set_updated_at();
create trigger floor_elements_updated before update on public.floor_plan_elements for each row execute function public.set_updated_at();
create trigger tables_updated before update on public.tables for each row execute function public.set_updated_at();
create trigger categories_updated before update on public.product_categories for each row execute function public.set_updated_at();
create trigger products_updated before update on public.products for each row execute function public.set_updated_at();
create trigger orders_updated before update on public.orders for each row execute function public.set_updated_at();
create trigger order_items_updated before update on public.order_items for each row execute function public.set_updated_at();

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$ begin insert into public.profiles(id,full_name,role) values(new.id,new.raw_user_meta_data->>'full_name',coalesce((new.raw_user_meta_data->>'role')::public.app_role,'WAITER')); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.current_role() returns public.app_role language sql stable security definer set search_path=public as $$ select role from public.profiles where id=auth.uid() $$;
create or replace function public.is_manager() returns boolean language sql stable security definer set search_path=public as $$ select public.current_role() in ('ADMIN','MANAGER') $$;
create or replace function public.replace_floor_plan_snapshot(p_floor_plan_id uuid,p_elements jsonb,p_tables jsonb) returns void language plpgsql security invoker as $$ begin delete from public.floor_plan_elements where floor_plan_id=p_floor_plan_id; delete from public.tables where floor_plan_id=p_floor_plan_id; insert into public.floor_plan_elements(floor_plan_id,kind,x,y,width,height,rotation,points,label,z_index) select p_floor_plan_id,(e->>'kind')::public.floor_element_kind,(e->>'x')::numeric,(e->>'y')::numeric,(e->>'width')::numeric,(e->>'height')::numeric,(e->>'rotation')::numeric,e->'points',e->>'label',(e->>'z_index')::integer from jsonb_array_elements(p_elements) e; insert into public.tables(floor_plan_id,number,x,y,width,height,rotation,shape) select p_floor_plan_id,(t->>'number')::integer,(t->>'x')::numeric,(t->>'y')::numeric,(t->>'width')::numeric,(t->>'height')::numeric,(t->>'rotation')::numeric,(t->>'shape')::public.table_shape from jsonb_array_elements(p_tables) t; end $$;

alter table public.profiles enable row level security; alter table public.floor_plans enable row level security; alter table public.floor_plan_elements enable row level security; alter table public.tables enable row level security; alter table public.product_categories enable row level security; alter table public.products enable row level security; alter table public.orders enable row level security; alter table public.order_items enable row level security;
create policy profiles_self_select on public.profiles for select using(id=auth.uid() or public.is_manager());
create policy profiles_manager_update on public.profiles for update using(public.is_manager()) with check(public.is_manager());
create policy plans_auth_select on public.floor_plans for select to authenticated using(true);
create policy plans_manager_insert on public.floor_plans for insert to authenticated with check(public.is_manager() and created_by=auth.uid());
create policy plans_manager_update on public.floor_plans for update to authenticated using(public.is_manager()) with check(public.is_manager());
create policy plans_manager_delete on public.floor_plans for delete to authenticated using(public.is_manager());
create policy elements_auth_select on public.floor_plan_elements for select to authenticated using(true);
create policy elements_manager_write on public.floor_plan_elements for all to authenticated using(public.is_manager()) with check(public.is_manager());
create policy tables_auth_select on public.tables for select to authenticated using(true);
create policy tables_manager_write on public.tables for all to authenticated using(public.is_manager()) with check(public.is_manager());
create policy categories_auth_select on public.product_categories for select to authenticated using(true);
create policy categories_manager_write on public.product_categories for all to authenticated using(public.is_manager()) with check(public.is_manager());
create policy products_auth_select on public.products for select to authenticated using(true);
create policy products_manager_write on public.products for all to authenticated using(public.is_manager()) with check(public.is_manager());
create policy orders_auth_select on public.orders for select to authenticated using(true);
create policy orders_auth_insert on public.orders for insert to authenticated with check(created_by=auth.uid());
create policy orders_manager_update on public.orders for update to authenticated using(public.is_manager() or created_by=auth.uid()) with check(public.is_manager() or created_by=auth.uid());
create policy orders_manager_delete on public.orders for delete to authenticated using(public.is_manager());
create policy items_auth_select on public.order_items for select to authenticated using(true);
create policy items_auth_insert on public.order_items for insert to authenticated with check(created_by=auth.uid());
create policy items_update_own_or_manager on public.order_items for update to authenticated using(public.is_manager() or created_by=auth.uid()) with check(public.is_manager() or created_by=auth.uid());
create policy items_manager_delete on public.order_items for delete to authenticated using(public.is_manager());

insert into public.product_categories(name,sort_order) values ('Alcohol',1),('Refrescos',2) on conflict do nothing;
insert into public.products(category_id,name,price) select id,'Whisky',7 from product_categories where name='Alcohol' on conflict do nothing;
insert into public.products(category_id,name,price) select id,'Ron',7 from product_categories where name='Alcohol' on conflict do nothing;
insert into public.products(category_id,name,price) select id,'Vodka',7 from product_categories where name='Alcohol' on conflict do nothing;
insert into public.products(category_id,name,price) select id,'Gin',7 from product_categories where name='Alcohol' on conflict do nothing;
insert into public.products(category_id,name,price) select id,'Tequila',7 from product_categories where name='Alcohol' on conflict do nothing;
insert into public.products(category_id,name,price) select id,'Coca-Cola',3 from product_categories where name='Refrescos' on conflict do nothing;
insert into public.products(category_id,name,price) select id,'Coca-Cola Zero',3 from product_categories where name='Refrescos' on conflict do nothing;
insert into public.products(category_id,name,price) select id,'Fanta',3 from product_categories where name='Refrescos' on conflict do nothing;
insert into public.products(category_id,name,price) select id,'Sprite',3 from product_categories where name='Refrescos' on conflict do nothing;
insert into public.products(category_id,name,price) select id,'Red Bull',4 from product_categories where name='Refrescos' on conflict do nothing;
insert into public.products(category_id,name,price) select id,'Agua',2 from product_categories where name='Refrescos' on conflict do nothing;

alter publication supabase_realtime add table public.orders; alter publication supabase_realtime add table public.order_items; alter publication supabase_realtime add table public.tables; alter publication supabase_realtime add table public.floor_plans;
