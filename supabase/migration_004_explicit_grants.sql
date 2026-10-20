-- Explicit API Grants — Supabase Migration
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
--
-- Supabase no longer grants table privileges to the API roles (anon,
-- authenticated, service_role) automatically
-- (https://github.com/orgs/supabase/discussions/45329). Migrations 001-003
-- relied on those implicit grants, so replaying them on a fresh project
-- leaves every table unreachable from the Data API.
--
-- Grants decide whether a role can touch a table at all; the RLS policies in
-- 001-003 still decide which rows. Grants below mirror those policies.
--
-- On the existing project this also removes the broad implicit grants
-- (e.g. anon INSERT/UPDATE/DELETE/TRUNCATE everywhere), so the live
-- database ends up with exactly the grants a fresh rebuild gets.
-- Safe to re-run: it resets to the same state each time.

BEGIN;

-- ============================================================================
-- RESET
-- ============================================================================

REVOKE ALL ON profiles, user_presets, shared_presets, bookmarks
    FROM anon, authenticated, service_role;

-- ============================================================================
-- GRANTS
-- ============================================================================

-- Profiles: public read, self write
GRANT SELECT ON profiles TO anon, authenticated;
GRANT INSERT, UPDATE ON profiles TO authenticated;

-- User presets: owner only (upsert needs INSERT + UPDATE + SELECT)
GRANT SELECT, INSERT, UPDATE, DELETE ON user_presets TO authenticated;

-- Shared presets: anyone can read share links and community profiles,
-- authors manage their own
GRANT SELECT ON shared_presets TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON shared_presets TO authenticated;

-- Bookmarks: signed-in users manage their own
GRANT SELECT, INSERT, DELETE ON bookmarks TO authenticated;

-- Service role bypasses RLS but still needs grants (scripts/backup_supabase.py)
GRANT SELECT, INSERT, UPDATE, DELETE
    ON profiles, user_presets, shared_presets, bookmarks
    TO service_role;

COMMIT;
