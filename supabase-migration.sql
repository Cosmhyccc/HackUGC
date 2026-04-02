-- Run this in your Supabase SQL editor
-- https://sbqjxbialudxehqkjcze.supabase.co → SQL Editor

create table if not exists profiles (
  id uuid references auth.users on delete cascade,
  subscribed boolean default false,
  plan text, -- 'monthly' | 'yearly'
  stripe_customer_id text,
  stripe_subscription_id text,
  subscribed_at timestamptz,
  created_at timestamptz default now(),
  primary key (id)
);

alter table profiles enable row level security;

-- Users can only read their own profile
create policy "Users can read own profile"
  on profiles for select
  using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
