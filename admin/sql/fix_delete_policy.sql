-- Allow anonymous users to DELETE data from the 'dramas' table
-- This is necessary for the admin tools (fix_duplicates.html, delete_dramas.html) to work
-- without full authentication implementation.

create policy "Allow delete for everyone" on dramas
for delete using (true);
