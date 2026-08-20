-- Stem figure source and presentation fields now live on stem_figure_revisions.
-- Keep the legacy columns temporarily for rollback/read compatibility, but new
-- parent rows must be insertable before their initial revision is created.
DO $$
DECLARE
  legacy_column TEXT;
BEGIN
  FOREACH legacy_column IN ARRAY ARRAY['latex_source', 'source_hash', 'alt_text']
  LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'stem_figures'
        AND column_name = legacy_column
    ) THEN
      EXECUTE format(
        'ALTER TABLE "stem_figures" ALTER COLUMN %I DROP NOT NULL',
        legacy_column
      );
    END IF;
  END LOOP;
END $$;
