-- Remove the existing foreign key constraint
ALTER TABLE user_library
DROP CONSTRAINT IF EXISTS user_library_drama_id_fkey;

-- Add the new foreign key constraint with ON DELETE CASCADE
ALTER TABLE user_library
ADD CONSTRAINT user_library_drama_id_fkey
FOREIGN KEY (drama_id)
REFERENCES dramas(id)
ON DELETE CASCADE;
