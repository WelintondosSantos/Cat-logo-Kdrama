-- Create user_library table to store favorites and status
create table if not exists user_library (
  user_id uuid references auth.users not null,
  drama_id bigint references dramas(id) not null,
  status text check (status in ('Assistidos', 'Assistindo', 'Assistir em breve', 'Terminar de assistir')),
  is_favorite boolean default false,
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  primary key (user_id, drama_id)
);

-- Enable RLS
alter table user_library enable row level security;

-- Policies
create policy "Users can view their own data" on user_library
  for select using (auth.uid() = user_id);

create policy "Users can insert their own data" on user_library
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own data" on user_library
  for update using (auth.uid() = user_id);

-- Policy to allow upsert (insert or update)
create policy "Users can delete their own data" on user_library
  for delete using (auth.uid() = user_id);
