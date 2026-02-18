-- Bookmarks — Supabase Migration
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
--
-- Allows users to bookmark community profiles.
-- Bookmarked profiles sort to the top of the community list.
-- Popular profiles (many bookmarks) rank higher for everyone.

-- ============================================================================
-- SCHEMA CHANGES
-- ============================================================================

-- Denormalized bookmark count on shared_presets for efficient sorting
ALTER TABLE shared_presets ADD COLUMN IF NOT EXISTS bookmark_count INTEGER DEFAULT 0;

-- Bookmarks table: one row per user/preset pair
CREATE TABLE bookmarks (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    preset_id   UUID NOT NULL REFERENCES shared_presets(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, preset_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Fast lookup of a user's bookmarks
CREATE INDEX idx_bookmarks_user ON bookmarks(user_id);

-- Fast lookup of who bookmarked a preset
CREATE INDEX idx_bookmarks_preset ON bookmarks(preset_id);

-- Community listing: sort by popularity then recency
CREATE INDEX idx_shared_presets_bookmarks
    ON shared_presets(bookmark_count DESC, created_at DESC)
    WHERE is_published = true;

-- ============================================================================
-- RLS
-- ============================================================================

ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;

-- Users can insert, read, and delete their own bookmarks
CREATE POLICY "bookmarks_manage_own"
    ON bookmarks FOR ALL
    USING (auth.uid() = user_id);

-- ============================================================================
-- TRIGGER — maintain bookmark_count on shared_presets
-- ============================================================================

CREATE OR REPLACE FUNCTION update_bookmark_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE shared_presets
        SET bookmark_count = bookmark_count + 1
        WHERE id = NEW.preset_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE shared_presets
        SET bookmark_count = GREATEST(bookmark_count - 1, 0)
        WHERE id = OLD.preset_id;
        RETURN OLD;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_bookmark_count
    AFTER INSERT OR DELETE ON bookmarks
    FOR EACH ROW EXECUTE FUNCTION update_bookmark_count();
