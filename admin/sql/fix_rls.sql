-- Allow anonymous users to INSERT data into the 'dramas' table
create policy "Allow insert for everyone" on dramas
for insert with check (true);

-- Allow anonymous users to INSERT data into the 'atores' table
create policy "Allow insert for everyone" on atores
for insert with check (true);
