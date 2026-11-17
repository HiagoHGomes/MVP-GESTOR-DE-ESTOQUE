create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  criado_em timestamptz not null default now()
);

create table if not exists public.user_tenants (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  criado_em timestamptz not null default now()
);

create table if not exists public.produtos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  nome text not null check (length(trim(nome)) > 0),
  sku text not null check (length(trim(sku)) > 0),
  categoria text,
  unidade text not null default 'un',
  estoque_minimo numeric(14, 3) not null default 0 check (estoque_minimo >= 0),
  estoque_atual numeric(14, 3) not null default 0 check (estoque_atual >= 0),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (tenant_id, sku)
);

create table if not exists public.movimentacoes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  produto_id uuid not null references public.produtos(id),
  tipo text not null check (tipo in ('entrada', 'saida', 'ajuste')),
  quantidade numeric(14, 3) not null check (
    (tipo = 'ajuste' and quantidade >= 0)
    or (tipo in ('entrada', 'saida') and quantidade > 0)
  ),
  observacao text,
  usuario_id uuid not null references auth.users(id),
  criado_em timestamptz not null default now()
);

create index if not exists produtos_tenant_ativo_nome_idx
  on public.produtos (tenant_id, ativo, nome);
create index if not exists movimentacoes_tenant_criado_em_idx
  on public.movimentacoes (tenant_id, criado_em desc);
create index if not exists movimentacoes_tenant_produto_criado_em_idx
  on public.movimentacoes (tenant_id, produto_id, criado_em desc);

create or replace function public.provision_tenant_for_user(p_user_id uuid, p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  tenant_name text;
  new_tenant_id uuid;
begin
  if exists (select 1 from public.user_tenants where user_id = p_user_id) then
    return;
  end if;

  tenant_name := coalesce(nullif(split_part(coalesce(p_email, ''), '@', 1), ''), 'Minha empresa');
  insert into public.tenants (nome) values (tenant_name) returning id into new_tenant_id;
  insert into public.user_tenants (user_id, tenant_id) values (p_user_id, new_tenant_id);
end;
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.provision_tenant_for_user(new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_provision_tenant on auth.users;
create trigger on_auth_user_created_provision_tenant
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

do $$
declare
  auth_user record;
begin
  for auth_user in
    select u.id, u.email
    from auth.users as u
    where not exists (
      select 1 from public.user_tenants as ut where ut.user_id = u.id
    )
  loop
    perform public.provision_tenant_for_user(auth_user.id, auth_user.email);
  end loop;
end;
$$;

revoke all on function public.provision_tenant_for_user(uuid, text) from public, anon, authenticated;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

create or replace function public.update_product_stock_from_movement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_stock numeric(14, 3);
  product_active boolean;
  next_stock numeric(14, 3);
begin
  select p.estoque_atual, p.ativo
    into current_stock, product_active
    from public.produtos as p
    where p.id = new.produto_id and p.tenant_id = new.tenant_id
    for update;

  if not found then
    raise exception 'Produto não encontrado nesta empresa.';
  end if;
  if not product_active then
    raise exception 'Não é possível movimentar um produto desativado.';
  end if;

  if new.tipo = 'entrada' then
    next_stock := current_stock + new.quantidade;
  elsif new.tipo = 'saida' then
    if new.quantidade > current_stock then
      raise exception 'A saída não pode ser maior que o saldo disponível (%).', current_stock;
    end if;
    next_stock := current_stock - new.quantidade;
  else
    next_stock := new.quantidade;
  end if;

  update public.produtos
    set estoque_atual = next_stock
    where id = new.produto_id and tenant_id = new.tenant_id;

  return new;
end;
$$;

drop trigger if exists movimentacoes_update_stock on public.movimentacoes;
create trigger movimentacoes_update_stock
  before insert on public.movimentacoes
  for each row execute function public.update_product_stock_from_movement();

revoke all on function public.update_product_stock_from_movement() from public, anon, authenticated;

alter table public.tenants enable row level security;
alter table public.user_tenants enable row level security;
alter table public.produtos enable row level security;
alter table public.movimentacoes enable row level security;

drop policy if exists "Members can read their tenant" on public.tenants;
create policy "Members can read their tenant"
  on public.tenants for select to authenticated
  using (exists (
    select 1 from public.user_tenants ut
    where ut.tenant_id = tenants.id and ut.user_id = (select auth.uid())
  ));

drop policy if exists "Users can read their tenant membership" on public.user_tenants;
create policy "Users can read their tenant membership"
  on public.user_tenants for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Members can read products" on public.produtos;
create policy "Members can read products"
  on public.produtos for select to authenticated
  using (exists (
    select 1 from public.user_tenants ut
    where ut.tenant_id = produtos.tenant_id and ut.user_id = (select auth.uid())
  ));

drop policy if exists "Members can create products" on public.produtos;
create policy "Members can create products"
  on public.produtos for insert to authenticated
  with check (exists (
    select 1 from public.user_tenants ut
    where ut.tenant_id = produtos.tenant_id and ut.user_id = (select auth.uid())
  ));

drop policy if exists "Members can update products" on public.produtos;
create policy "Members can update products"
  on public.produtos for update to authenticated
  using (exists (
    select 1 from public.user_tenants ut
    where ut.tenant_id = produtos.tenant_id and ut.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.user_tenants ut
    where ut.tenant_id = produtos.tenant_id and ut.user_id = (select auth.uid())
  ));

drop policy if exists "Members can read movements" on public.movimentacoes;
create policy "Members can read movements"
  on public.movimentacoes for select to authenticated
  using (exists (
    select 1 from public.user_tenants ut
    where ut.tenant_id = movimentacoes.tenant_id and ut.user_id = (select auth.uid())
  ));

drop policy if exists "Members can create movements" on public.movimentacoes;
create policy "Members can create movements"
  on public.movimentacoes for insert to authenticated
  with check (
    usuario_id = (select auth.uid())
    and exists (
      select 1 from public.user_tenants ut
      where ut.tenant_id = movimentacoes.tenant_id and ut.user_id = (select auth.uid())
    )
  );

revoke all on public.tenants, public.user_tenants, public.produtos, public.movimentacoes
  from anon, authenticated;
grant select on public.tenants, public.user_tenants, public.produtos, public.movimentacoes to authenticated;
grant insert (tenant_id, nome, sku, categoria, unidade, estoque_minimo)
  on public.produtos to authenticated;
grant update (nome, sku, categoria, unidade, estoque_minimo, ativo)
  on public.produtos to authenticated;
grant insert (tenant_id, produto_id, tipo, quantidade, observacao, usuario_id)
  on public.movimentacoes to authenticated;
