-- D31.UNIVERSE — Sovereign Post Schema (canonical)
-- User-defined columns kept exactly. Safe additions are clearly marked.

CREATE TABLE d31_posts (
    id SERIAL PRIMARY KEY,
    post_id VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    layer VARCHAR(50) NOT NULL, -- 'RANGE', 'CONTROL', 'FORCE', 'EXPRESSION', 'IDENTITY'
    skills TEXT[] NOT NULL,
    core_skill VARCHAR(100) NOT NULL,
    cover_url TEXT NOT NULL,
    videos TEXT[] DEFAULT '{}',
    photos TEXT[] DEFAULT '{}',
    pdfs TEXT[] DEFAULT '{}',
    content JSONB NOT NULL, -- { "summary": "", "technique": "", "biomechanics": "", "coaching": "" }
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Indexing for instant search (canonical expression — immutable with regconfig literal)
CREATE INDEX idx_d31_posts_search ON d31_posts
  USING gin (to_tsvector('english', title || ' ' || core_skill || ' ' || layer));

-- ── Safe additions (non-breaking) ───────────────────────────────────────────

-- Restrict layer to the five D31 training layers
ALTER TABLE d31_posts
  ADD CONSTRAINT d31_posts_layer_check
  CHECK (layer IN ('RANGE', 'CONTROL', 'FORCE', 'EXPRESSION', 'IDENTITY'));

-- GIN index for skills[] containment / overlap filters (@>, &&)
CREATE INDEX idx_d31_posts_skills ON d31_posts USING gin (skills);

-- Row Level Security: public read, authenticated write
ALTER TABLE d31_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "d31_posts_public_read"
  ON d31_posts FOR SELECT
  TO anon, authenticated
  USING (true);

-- Write policies (admin-only) are created in 0002_app_schema.sql once profiles.role exists.

-- Full-text search RPC using the exact indexed expression + websearch_to_tsquery
CREATE OR REPLACE FUNCTION search_d31_posts(q text)
RETURNS SETOF d31_posts
LANGUAGE sql
STABLE
AS $$
  SELECT *
  FROM d31_posts
  WHERE q IS NULL
     OR btrim(q) = ''
     OR to_tsvector('english', title || ' ' || core_skill || ' ' || layer)
        @@ websearch_to_tsquery('english', q)
  ORDER BY created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION search_d31_posts(text) TO anon, authenticated;
