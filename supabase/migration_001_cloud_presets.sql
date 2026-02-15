-- Overstand Cloud Presets — Supabase Migration
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
--
-- Creates tables for:
--   1. User profiles (extends Supabase auth.users)
--   2. Cloud presets (private, per-user)
--   3. Shared presets (immutable snapshots for link sharing)

-- ============================================================================
-- TABLES
-- ============================================================================

-- User profiles (extends auth.users with display info)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cloud presets (private, per-user storage)
CREATE TABLE user_presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    preset_name TEXT NOT NULL,
    description TEXT DEFAULT '',
    metadata JSONB NOT NULL,      -- { version, timestamp, description }
    parameters JSONB NOT NULL,    -- { instrument_family, vsl, body_length, ... }
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, preset_name)  -- same name per user = overwrite
);

-- Shared presets (immutable snapshots for link sharing)
CREATE TABLE shared_presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    share_token TEXT UNIQUE NOT NULL,
    owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    preset_name TEXT NOT NULL,
    metadata JSONB NOT NULL,
    parameters JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    view_count INTEGER DEFAULT 0
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_user_presets_user_id ON user_presets(user_id);
CREATE INDEX idx_user_presets_updated ON user_presets(updated_at DESC);
CREATE INDEX idx_shared_presets_token ON shared_presets(share_token);
CREATE INDEX idx_shared_presets_owner ON shared_presets(owner_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_presets ENABLE ROW LEVEL SECURITY;

-- Profiles: public read, self write
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- User presets: owner only (all operations)
CREATE POLICY "user_presets_select" ON user_presets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_presets_insert" ON user_presets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_presets_update" ON user_presets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "user_presets_delete" ON user_presets FOR DELETE USING (auth.uid() = user_id);

-- Shared presets: anyone can read, authenticated users can create their own
CREATE POLICY "shared_presets_select" ON shared_presets FOR SELECT USING (true);
CREATE POLICY "shared_presets_insert" ON shared_presets FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Auto-update updated_at on row modification
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_presets_updated_at
    BEFORE UPDATE ON user_presets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Generate unique 8-character share tokens
CREATE OR REPLACE FUNCTION generate_share_token()
RETURNS TEXT AS $$
DECLARE
    token TEXT;
    taken BOOLEAN;
BEGIN
    LOOP
        token := encode(gen_random_bytes(6), 'base64');
        token := replace(replace(token, '/', '_'), '+', '-');
        token := substring(token, 1, 8);
        SELECT EXISTS(SELECT 1 FROM shared_presets WHERE share_token = token) INTO taken;
        EXIT WHEN NOT taken;
    END LOOP;
    RETURN token;
END;
$$ LANGUAGE plpgsql;

-- Increment share link view count (callable without auth via RPC)
CREATE OR REPLACE FUNCTION increment_view_count(token TEXT)
RETURNS void AS $$
BEGIN
    UPDATE shared_presets
    SET view_count = view_count + 1
    WHERE share_token = token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- NOTE: No auto-create profile trigger. Profiles are created on-demand
-- by the app if needed. The trigger approach is fragile (username uniqueness
-- conflicts block signup entirely).
