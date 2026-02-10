-- Create table for Dramas
create table if not exists dramas (
  id bigint primary key generated always as identity,
  title text not null,
  image text,
  genres text[],
  status text,
  ano int,
  sinopse text,
  elenco text[],
  episodios int
);

-- Create table for Actors
create table if not exists atores (
  id bigint primary key generated always as identity,
  name text not null,
  image text
);

-- Enable Row Level Security (RLS) is recommended, but for this simple read-only public site, 
-- we can leave it open for reading or add a policy.
-- For simplicity in this migration, let's enable RLS but allow public select.
alter table dramas enable row level security;
create policy "Public dramas are viewable by everyone" on dramas
  for select using (true);

alter table atores enable row level security;
create policy "Public actors are viewable by everyone" on atores
  for select using (true);
