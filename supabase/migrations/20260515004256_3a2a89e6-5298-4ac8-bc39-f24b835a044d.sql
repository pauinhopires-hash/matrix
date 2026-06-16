
-- =========================================
-- ENUMS
-- =========================================
create type public.app_role as enum ('admin', 'gerente', 'atendimento', 'cozinha', 'caixa');
create type public.lider_tipo as enum ('lider_cozinha', 'lider_caixa', 'lider_atendimento');
create type public.sublocal_tipo as enum ('geladeira', 'congelador', 'prateleira', 'filtro', 'outro');
create type public.movimento_tipo as enum ('entrada', 'retirada', 'porcionamento', 'ajuste', 'transferencia');
create type public.requisicao_status as enum ('pendente', 'atendida', 'recusada', 'cancelada');
create type public.user_status as enum ('pending', 'approved', 'rejected');

-- =========================================
-- PROFILES
-- =========================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  email text not null,
  status public.user_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- =========================================
-- USER ROLES
-- =========================================
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique(user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

create or replace function public.is_staff(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role in ('admin','gerente')
  )
$$;

-- =========================================
-- LOCAIS
-- =========================================
create table public.locais (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  responsavel public.lider_tipo,
  created_at timestamptz not null default now()
);
alter table public.locais enable row level security;

-- =========================================
-- SUBLOCAIS
-- =========================================
create table public.sublocais (
  id uuid primary key default gen_random_uuid(),
  local_id uuid not null references public.locais(id) on delete cascade,
  nome text not null,
  tipo public.sublocal_tipo not null default 'outro',
  lider public.lider_tipo,
  created_at timestamptz not null default now(),
  unique(local_id, nome)
);
alter table public.sublocais enable row level security;

-- =========================================
-- CATEGORIAS / SUBCATEGORIAS
-- =========================================
create table public.categorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  created_at timestamptz not null default now()
);
alter table public.categorias enable row level security;

create table public.subcategorias (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid not null references public.categorias(id) on delete cascade,
  nome text not null,
  created_at timestamptz not null default now(),
  unique(categoria_id, nome)
);
alter table public.subcategorias enable row level security;

-- =========================================
-- PRODUTOS
-- =========================================
create table public.produtos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  unidade text not null default 'un',
  valor_unit numeric(12,2),
  estoque_minimo numeric(12,3) not null default 0,
  foto_url text,
  subcategoria_id uuid references public.subcategorias(id) on delete set null,
  default_sublocal_id uuid references public.sublocais(id) on delete set null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.produtos enable row level security;
create index produtos_subcategoria_idx on public.produtos(subcategoria_id);
create index produtos_default_sublocal_idx on public.produtos(default_sublocal_id);
create index produtos_nome_idx on public.produtos(lower(nome));

-- =========================================
-- SALDOS (por produto + sublocal)
-- =========================================
create table public.saldos (
  produto_id uuid not null references public.produtos(id) on delete cascade,
  sublocal_id uuid not null references public.sublocais(id) on delete cascade,
  quantidade numeric(12,3) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (produto_id, sublocal_id)
);
alter table public.saldos enable row level security;

-- =========================================
-- MOVIMENTOS
-- =========================================
create table public.movimentos (
  id uuid primary key default gen_random_uuid(),
  tipo public.movimento_tipo not null,
  produto_id uuid not null references public.produtos(id) on delete restrict,
  quantidade numeric(12,3) not null check (quantidade > 0),
  sublocal_origem_id uuid references public.sublocais(id) on delete set null,
  sublocal_destino_id uuid references public.sublocais(id) on delete set null,
  produto_destino_id uuid references public.produtos(id) on delete set null,
  quantidade_destino numeric(12,3),
  user_id uuid references auth.users(id) on delete set null,
  foto_url text,
  observacao text,
  created_at timestamptz not null default now()
);
alter table public.movimentos enable row level security;
create index movimentos_produto_idx on public.movimentos(produto_id);
create index movimentos_created_idx on public.movimentos(created_at desc);

-- =========================================
-- REQUISICOES
-- =========================================
create table public.requisicoes (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references public.produtos(id) on delete restrict,
  sublocal_id uuid references public.sublocais(id) on delete set null,
  quantidade numeric(12,3) not null check (quantidade > 0),
  status public.requisicao_status not null default 'pendente',
  solicitante_id uuid references auth.users(id) on delete set null,
  atendido_por uuid references auth.users(id) on delete set null,
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.requisicoes enable row level security;
create index requisicoes_status_idx on public.requisicoes(status);

-- =========================================
-- TRIGGER: aplicar movimento aos saldos
-- =========================================
create or replace function public.aplicar_movimento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tipo = 'entrada' then
    if new.sublocal_destino_id is null then
      raise exception 'Entrada exige sublocal_destino_id';
    end if;
    insert into public.saldos (produto_id, sublocal_id, quantidade)
    values (new.produto_id, new.sublocal_destino_id, new.quantidade)
    on conflict (produto_id, sublocal_id)
    do update set quantidade = public.saldos.quantidade + excluded.quantidade,
                  updated_at = now();

  elsif new.tipo = 'retirada' then
    if new.sublocal_origem_id is null then
      raise exception 'Retirada exige sublocal_origem_id';
    end if;
    insert into public.saldos (produto_id, sublocal_id, quantidade)
    values (new.produto_id, new.sublocal_origem_id, -new.quantidade)
    on conflict (produto_id, sublocal_id)
    do update set quantidade = public.saldos.quantidade - new.quantidade,
                  updated_at = now();

  elsif new.tipo = 'transferencia' then
    if new.sublocal_origem_id is null or new.sublocal_destino_id is null then
      raise exception 'Transferência exige origem e destino';
    end if;
    insert into public.saldos (produto_id, sublocal_id, quantidade)
    values (new.produto_id, new.sublocal_origem_id, -new.quantidade)
    on conflict (produto_id, sublocal_id)
    do update set quantidade = public.saldos.quantidade - new.quantidade,
                  updated_at = now();
    insert into public.saldos (produto_id, sublocal_id, quantidade)
    values (new.produto_id, new.sublocal_destino_id, new.quantidade)
    on conflict (produto_id, sublocal_id)
    do update set quantidade = public.saldos.quantidade + new.quantidade,
                  updated_at = now();

  elsif new.tipo = 'porcionamento' then
    -- consome produto origem
    if new.sublocal_origem_id is null then
      raise exception 'Porcionamento exige sublocal_origem_id';
    end if;
    insert into public.saldos (produto_id, sublocal_id, quantidade)
    values (new.produto_id, new.sublocal_origem_id, -new.quantidade)
    on conflict (produto_id, sublocal_id)
    do update set quantidade = public.saldos.quantidade - new.quantidade,
                  updated_at = now();
    -- gera produto destino se informado
    if new.produto_destino_id is not null and new.quantidade_destino is not null then
      insert into public.saldos (produto_id, sublocal_id, quantidade)
      values (new.produto_destino_id, coalesce(new.sublocal_destino_id, new.sublocal_origem_id), new.quantidade_destino)
      on conflict (produto_id, sublocal_id)
      do update set quantidade = public.saldos.quantidade + new.quantidade_destino,
                    updated_at = now();
    end if;

  elsif new.tipo = 'ajuste' then
    -- ajuste seta quantidade absoluta no sublocal_destino_id
    if new.sublocal_destino_id is null then
      raise exception 'Ajuste exige sublocal_destino_id';
    end if;
    insert into public.saldos (produto_id, sublocal_id, quantidade)
    values (new.produto_id, new.sublocal_destino_id, new.quantidade)
    on conflict (produto_id, sublocal_id)
    do update set quantidade = new.quantidade, updated_at = now();
  end if;

  return new;
end;
$$;

create trigger trg_aplicar_movimento
after insert on public.movimentos
for each row execute function public.aplicar_movimento();

-- =========================================
-- TRIGGER: criar profile no signup
-- =========================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nome, email, status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', new.email),
    new.email,
    'pending'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- =========================================
-- TRIGGER: updated_at
-- =========================================
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger touch_profiles before update on public.profiles
for each row execute function public.touch_updated_at();
create trigger touch_produtos before update on public.produtos
for each row execute function public.touch_updated_at();
create trigger touch_requisicoes before update on public.requisicoes
for each row execute function public.touch_updated_at();

-- =========================================
-- RLS POLICIES
-- =========================================

-- profiles: usuário vê o próprio; staff vê todos; staff aprova
create policy "profiles select own" on public.profiles for select to authenticated
  using (auth.uid() = id or public.is_staff(auth.uid()));
create policy "profiles update own" on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles staff update" on public.profiles for update to authenticated
  using (public.is_staff(auth.uid()));

-- user_roles: usuário vê próprios; só admin gerencia
create policy "roles select own or staff" on public.user_roles for select to authenticated
  using (auth.uid() = user_id or public.is_staff(auth.uid()));
create policy "roles admin manage" on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- locais / sublocais / categorias / subcategorias: leitura para todo autenticado, escrita só staff
create policy "locais read" on public.locais for select to authenticated using (true);
create policy "locais staff write" on public.locais for all to authenticated
  using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

create policy "sublocais read" on public.sublocais for select to authenticated using (true);
create policy "sublocais staff write" on public.sublocais for all to authenticated
  using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

create policy "categorias read" on public.categorias for select to authenticated using (true);
create policy "categorias staff write" on public.categorias for all to authenticated
  using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

create policy "subcategorias read" on public.subcategorias for select to authenticated using (true);
create policy "subcategorias staff write" on public.subcategorias for all to authenticated
  using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

-- produtos: leitura todos, escrita só staff
create policy "produtos read" on public.produtos for select to authenticated using (true);
create policy "produtos staff write" on public.produtos for all to authenticated
  using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

-- saldos: leitura todos; escrita pelo trigger (security definer) — bloqueia escrita direta
create policy "saldos read" on public.saldos for select to authenticated using (true);

-- movimentos: qualquer autenticado pode lançar e ler
create policy "movimentos read" on public.movimentos for select to authenticated using (true);
create policy "movimentos insert" on public.movimentos for insert to authenticated
  with check (auth.uid() = user_id or user_id is null);

-- requisicoes: autenticados criam/leem; staff atualiza
create policy "requisicoes read" on public.requisicoes for select to authenticated using (true);
create policy "requisicoes insert" on public.requisicoes for insert to authenticated
  with check (auth.uid() = solicitante_id);
create policy "requisicoes update staff" on public.requisicoes for update to authenticated
  using (public.is_staff(auth.uid()));

-- =========================================
-- STORAGE: bucket para fotos de movimentos/produtos
-- =========================================
insert into storage.buckets (id, name, public)
values ('estoque-fotos', 'estoque-fotos', true)
on conflict (id) do nothing;

create policy "estoque-fotos read" on storage.objects for select
  using (bucket_id = 'estoque-fotos');
create policy "estoque-fotos auth upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'estoque-fotos');
create policy "estoque-fotos auth update" on storage.objects for update to authenticated
  using (bucket_id = 'estoque-fotos');
