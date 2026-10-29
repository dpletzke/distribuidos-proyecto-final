\set ON_ERROR_STOP on
BEGIN;
\ir migrations/001_initial.sql
\ir migrations/002_integrity.sql
COMMIT;
