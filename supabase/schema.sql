-- 1. Tables
create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text check (role in ('admin','user')) default 'user',
  is_active boolean default true,
  created_at timestamptz default now()
);

create table public.websites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text unique not null,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- 2. Trigger for New Users
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_profiles (id, email, role)
  values (new.id, new.email, 'user');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 3. Security (RLS)
alter table public.user_profiles enable row level security;
alter table public.websites enable row level security;

-- Policies
create policy "Users read own profile" on public.user_profiles 
for select using (auth.uid() = id);

create policy "Admins full access profiles" on public.user_profiles 
for all using (exists (select 1 from public.user_profiles where id = auth.uid() and role = 'admin'));

create policy "Public read active websites" on public.websites 
for select using (is_active = true);

create policy "Admins full access websites" on public.websites 
for all using (exists (select 1 from public.user_profiles where id = auth.uid() and role = 'admin'));