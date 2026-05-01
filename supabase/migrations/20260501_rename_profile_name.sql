-- Rename user_profiles.name → profile_name
-- App code (7 files) uses profile_name; schema.sql used 'name' by mistake
ALTER TABLE user_profiles RENAME COLUMN name TO profile_name;
