-- Community Profiles — Supabase Migration
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
--
-- Extends shared_presets for community publishing:
--   - is_published flag to distinguish community profiles from link-shares
--   - author_name (denormalized) for display
--   - description for community listing
--   - instrument_family for filtering

-- ============================================================================
-- NEW COLUMNS
-- ============================================================================

ALTER TABLE shared_presets ADD COLUMN is_published BOOLEAN DEFAULT false;
ALTER TABLE shared_presets ADD COLUMN author_name TEXT;
ALTER TABLE shared_presets ADD COLUMN description TEXT DEFAULT '';
ALTER TABLE shared_presets ADD COLUMN instrument_family TEXT;

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Fast community listing: published profiles by recency
CREATE INDEX idx_shared_presets_published
    ON shared_presets(is_published, created_at DESC)
    WHERE is_published = true;

-- Filter by instrument family within published profiles
CREATE INDEX idx_shared_presets_instrument
    ON shared_presets(instrument_family)
    WHERE is_published = true;

-- One published profile per name per user (prevents duplicate publishes)
CREATE UNIQUE INDEX idx_shared_presets_unique_published
    ON shared_presets(owner_id, preset_name)
    WHERE is_published = true;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Author can delete their own shared/published presets
CREATE POLICY "shared_presets_delete_own"
    ON shared_presets FOR DELETE
    USING (auth.uid() = owner_id);

-- Author can update their own shared/published presets
CREATE POLICY "shared_presets_update_own"
    ON shared_presets FOR UPDATE
    USING (auth.uid() = owner_id);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Increment view count by preset ID (for community profiles loaded by ID)
CREATE OR REPLACE FUNCTION increment_view_count_by_id(preset_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE shared_presets
    SET view_count = view_count + 1
    WHERE id = preset_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
