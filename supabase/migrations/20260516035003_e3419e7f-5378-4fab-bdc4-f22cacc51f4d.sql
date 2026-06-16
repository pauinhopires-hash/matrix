
alter table public.profiles
  add column if not exists cargo text,
  add column if not exists setor text,
  add column if not exists foto_url text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nome, email, status, cargo, setor, foto_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', new.email),
    new.email,
    'pending',
    new.raw_user_meta_data->>'cargo',
    new.raw_user_meta_data->>'setor',
    new.raw_user_meta_data->>'foto_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Ensure trigger exists
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Ensure touch_updated_at trigger exists on profiles
drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();
