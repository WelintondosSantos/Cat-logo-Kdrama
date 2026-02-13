-- Create reviews table
create table if not exists reviews (
  id bigint primary key generated always as identity,
  user_id uuid references auth.users not null,
  drama_id bigint references dramas(id) not null,
  rating int check (rating >= 1 and rating <= 5),
  comment text,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Enable RLS
alter table reviews enable row level security;

-- Policies

-- Everyone can read reviews
create policy "Reviews are viewable by everyone" on reviews
  for select using (true);

-- Users can insert their own reviews
create policy "Users can insert their own reviews" on reviews
  for insert with check (auth.uid() = user_id);

-- Users can update their own reviews
create policy "Users can update their own reviews" on reviews
  for update using (auth.uid() = user_id);

-- Users can delete their own reviews
create policy "Users can delete their own reviews" on reviews
  for delete using (auth.uid() = user_id);
