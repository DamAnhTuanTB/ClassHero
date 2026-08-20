-- Hard cutover: runtime after this migration only accepts figure plan v3.
-- There is intentionally no v1/v2 reader or dual-write period.

CREATE OR REPLACE FUNCTION pg_temp.remove_jsonb_key_recursive(
  input_value JSONB,
  key_to_remove TEXT
)
RETURNS JSONB
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT CASE jsonb_typeof(input_value)
    WHEN 'object' THEN COALESCE(
      (
        SELECT jsonb_object_agg(
          entry.key,
          pg_temp.remove_jsonb_key_recursive(entry.value, key_to_remove)
        )
        FROM jsonb_each(input_value) AS entry
        WHERE entry.key <> key_to_remove
      ),
      '{}'::JSONB
    )
    WHEN 'array' THEN COALESCE(
      (
        SELECT jsonb_agg(
          pg_temp.remove_jsonb_key_recursive(element.value, key_to_remove)
        )
        FROM jsonb_array_elements(input_value) AS element
      ),
      '[]'::JSONB
    )
    ELSE input_value
  END
$$;

-- Historical local data predates both plan versioning and sourceTarget. Convert
-- it once here; runtime deliberately has no equivalent inference path.
UPDATE "stem_figures"
SET "status" = 'NEEDS_REVIEW'
WHERE "deleted_at" IS NULL
  AND (
    "plan_json" IS NULL
    OR jsonb_typeof("plan_json") IS DISTINCT FROM 'object'
    OR jsonb_typeof("plan_json"->'sourceReferences') IS DISTINCT FROM 'array'
  );

WITH normalized_plans AS (
  SELECT
    figure."id",
    CASE
      WHEN jsonb_typeof(figure."plan_json"->'sourceReferences') = 'array' THEN
        COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'packetPageNumber', reference.value->'packetPageNumber',
                'printedPageLabel', reference.value->'printedPageLabel',
                'figureLabel', reference.value->'figureLabel',
                'sourceTarget', CASE
                  WHEN reference.value ? 'sourceTarget'
                    THEN reference.value->'sourceTarget'
                  WHEN COALESCE(BTRIM(reference.value->>'figureLabel'), '') <> ''
                    THEN jsonb_build_object(
                      'scope', 'WHOLE_FIGURE',
                      'locator', NULL
                    )
                  ELSE '{}'::JSONB
                END
              )
              ORDER BY reference.ordinality
            )
            FROM jsonb_array_elements(
              figure."plan_json"->'sourceReferences'
            ) WITH ORDINALITY AS reference(value, ordinality)
          ),
          '[]'::JSONB
        )
      ELSE '[]'::JSONB
    END AS "source_references",
    CASE
      WHEN COALESCE(
        figure."plan_json"->>'localId',
        figure."local_plan_id"
      ) ~ '^F[0-9]+$'
      AND SUBSTRING(
        COALESCE(figure."plan_json"->>'localId', figure."local_plan_id")
        FROM 2
      )::INTEGER BETWEEN 1 AND 999
        THEN 'F' || LPAD(
          SUBSTRING(
            COALESCE(figure."plan_json"->>'localId', figure."local_plan_id")
            FROM 2
          )::INTEGER::TEXT,
          3,
          '0'
        )
      ELSE 'F' || LPAD((figure."figure_index" + 1)::TEXT, 3, '0')
    END AS "local_id",
    CASE
      WHEN jsonb_typeof(figure."plan_json"->'altText') IN ('string', 'null')
        THEN jsonb_build_object('altText', figure."plan_json"->'altText')
      ELSE '{}'::JSONB
    END AS "alt_text_json",
    CASE
      WHEN jsonb_typeof(figure."plan_json"->'caption') IN ('string', 'null')
        THEN jsonb_build_object('caption', figure."plan_json"->'caption')
      ELSE '{}'::JSONB
    END AS "caption_json"
  FROM "stem_figures" AS figure
),
canonical_plans AS (
  SELECT
    "id",
    jsonb_build_object(
      'figurePlanContractVersion', 3,
      'figureOrigin', CASE
        WHEN jsonb_array_length("source_references") > 0
          THEN 'TEXTBOOK_SOURCE'
        ELSE 'GENERATED_FROM_BRIEF'
      END,
      'sourceReferences', "source_references",
      'localId', "local_id"
    ) || "alt_text_json" || "caption_json" AS "plan_json"
  FROM normalized_plans
)
UPDATE "stem_figures" AS figure
SET "plan_json" = canonical."plan_json"
FROM canonical_plans AS canonical
WHERE figure."id" = canonical."id";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "stem_figures"
    WHERE "deleted_at" IS NULL
      AND (
        "plan_json" IS NULL
        OR jsonb_typeof("plan_json") <> 'object'
        OR "plan_json"->>'figurePlanContractVersion' IS DISTINCT FROM '3'
        OR "plan_json"->>'figureOrigin' IS NULL
        OR "plan_json"->>'figureOrigin' NOT IN (
          'TEXTBOOK_SOURCE',
          'GENERATED_FROM_BRIEF'
        )
        OR jsonb_typeof("plan_json"->'sourceReferences') IS DISTINCT FROM 'array'
        OR CASE
          WHEN jsonb_typeof("plan_json"->'sourceReferences') = 'array'
            THEN jsonb_array_length("plan_json"->'sourceReferences') > 5
          ELSE FALSE
        END
        OR COALESCE("plan_json"->>'localId', '') !~ '^F[0-9]{3}$'
        OR EXISTS (
          SELECT 1
          FROM jsonb_object_keys(
            CASE
              WHEN jsonb_typeof("plan_json") = 'object' THEN "plan_json"
              ELSE '{}'::JSONB
            END
          ) AS plan_key
          WHERE plan_key NOT IN (
            'figurePlanContractVersion',
            'figureOrigin',
            'sourceReferences',
            'localId',
            'altText',
            'caption'
          )
        )
        OR (
          "plan_json" ? 'altText'
          AND jsonb_typeof("plan_json"->'altText') NOT IN ('string', 'null')
        )
        OR (
          "plan_json" ? 'caption'
          AND jsonb_typeof("plan_json"->'caption') NOT IN ('string', 'null')
        )
        OR CASE
          WHEN jsonb_typeof("plan_json"->'sourceReferences') = 'array' THEN
            (
              "plan_json"->>'figureOrigin' = 'TEXTBOOK_SOURCE'
              AND jsonb_array_length("plan_json"->'sourceReferences') = 0
            )
            OR (
              "plan_json"->>'figureOrigin' = 'GENERATED_FROM_BRIEF'
              AND jsonb_array_length("plan_json"->'sourceReferences') <> 0
            )
          ELSE FALSE
        END
        OR EXISTS (
          SELECT 1
          FROM jsonb_array_elements(
            CASE
              WHEN jsonb_typeof("plan_json"->'sourceReferences') = 'array'
                THEN "plan_json"->'sourceReferences'
              ELSE '[]'::JSONB
            END
          ) AS reference
          WHERE jsonb_typeof(reference) IS DISTINCT FROM 'object'
            OR NOT (
              reference ?& ARRAY[
                'packetPageNumber',
                'printedPageLabel',
                'figureLabel',
                'sourceTarget'
              ]
            )
            OR EXISTS (
              SELECT 1
              FROM jsonb_object_keys(
                CASE
                  WHEN jsonb_typeof(reference) = 'object' THEN reference
                  ELSE '{}'::JSONB
                END
              ) AS reference_key
              WHERE reference_key NOT IN (
                'packetPageNumber',
                'printedPageLabel',
                'figureLabel',
                'sourceTarget'
              )
            )
            OR CASE
              WHEN jsonb_typeof(reference->'packetPageNumber') = 'number'
                THEN (reference->>'packetPageNumber')::NUMERIC <= 0
              ELSE TRUE
            END
            OR jsonb_typeof(reference->'printedPageLabel') NOT IN ('string', 'null')
            OR jsonb_typeof(reference->'figureLabel') NOT IN ('string', 'null')
            OR jsonb_typeof(reference->'sourceTarget') IS DISTINCT FROM 'object'
            OR NOT (
              reference->'sourceTarget' ?& ARRAY['scope', 'locator']
            )
            OR EXISTS (
              SELECT 1
              FROM jsonb_object_keys(
                CASE
                  WHEN jsonb_typeof(reference->'sourceTarget') = 'object'
                    THEN reference->'sourceTarget'
                  ELSE '{}'::JSONB
                END
              ) AS target_key
              WHERE target_key NOT IN ('scope', 'locator')
            )
            OR reference->'sourceTarget'->>'scope' NOT IN (
              'WHOLE_FIGURE',
              'SUBFIGURE'
            )
            OR (
              reference->'sourceTarget'->>'scope' = 'WHOLE_FIGURE'
              AND reference->'sourceTarget'->'locator' IS DISTINCT FROM 'null'::JSONB
            )
            OR (
              reference->'sourceTarget'->>'scope' = 'SUBFIGURE'
              AND COALESCE(BTRIM(reference->'sourceTarget'->>'locator'), '') = ''
            )
        )
      )
  ) THEN
    RAISE EXCEPTION 'STEM_FIGURE_PLAN_V3_PREFLIGHT_FAILED: plan cannot be normalized';
  END IF;
END
$$;

UPDATE "background_jobs"
SET
  "status" = 'CANCELLED',
  "error_message" = 'STEM_FIGURE_PLAN_V3_CUTOVER',
  "finished_at" = NOW(),
  "updated_at" = NOW()
WHERE "queue" = 'DIAGRAM_RENDERING'
  AND "status" IN ('QUEUED', 'RUNNING');

UPDATE "stem_figure_revisions"
SET "status" = 'NEEDS_REVIEW'
WHERE "status" IN ('QUEUED', 'RENDERING', 'REPAIRING');

UPDATE "stem_figures"
SET "status" = 'NEEDS_REVIEW'
WHERE "status" IN ('QUEUED', 'RENDERING', 'REPAIRING');

UPDATE "stem_figures"
SET "plan_json" = jsonb_set(
  pg_temp.remove_jsonb_key_recursive("plan_json", 'visualIntent'),
  '{figurePlanContractVersion}',
  '3'::JSONB,
  TRUE
)
WHERE "plan_json" IS NOT NULL;

UPDATE "lesson_summaries"
SET "content_json" = pg_temp.remove_jsonb_key_recursive(
  "content_json",
  'visualIntent'
)
WHERE "content_json"::TEXT LIKE '%"visualIntent"%';

UPDATE "ai_generations"
SET
  "output_json" = pg_temp.remove_jsonb_key_recursive(
    "output_json",
    'visualIntent'
  ),
  "output_hash" = NULL
WHERE "output_json"::TEXT LIKE '%"visualIntent"%';

UPDATE "background_jobs"
SET
  "input_meta_json" = CASE
    WHEN "input_meta_json" IS NULL THEN NULL
    ELSE pg_temp.remove_jsonb_key_recursive("input_meta_json", 'visualIntent')
  END,
  "result_json" = CASE
    WHEN "result_json" IS NULL THEN NULL
    ELSE pg_temp.remove_jsonb_key_recursive("result_json", 'visualIntent')
  END
WHERE COALESCE("input_meta_json"::TEXT, '') LIKE '%"visualIntent"%'
   OR COALESCE("result_json"::TEXT, '') LIKE '%"visualIntent"%';

UPDATE "stem_figure_revisions"
SET
  "reference_snapshot_json" = CASE
    WHEN "reference_snapshot_json" IS NULL THEN NULL
    ELSE pg_temp.remove_jsonb_key_recursive(
      "reference_snapshot_json",
      'visualIntent'
    )
  END,
  "reference_snapshot_hash" = NULL,
  "provider_request_snapshots_json" = NULL,
  "generation_brief_hash" = NULL
WHERE COALESCE("reference_snapshot_json"::TEXT, '') LIKE '%"visualIntent"%'
   OR COALESCE("provider_request_snapshots_json"::TEXT, '') LIKE '%"visualIntent"%'
   OR "generation_brief_hash" IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "stem_figures"
    WHERE "deleted_at" IS NULL
      AND (
        "plan_json" IS NULL
        OR "plan_json"->>'figurePlanContractVersion' IS DISTINCT FROM '3'
        OR "plan_json"::TEXT LIKE '%"visualIntent"%'
      )
  ) OR EXISTS (
    SELECT 1 FROM "lesson_summaries"
    WHERE "content_json"::TEXT LIKE '%"visualIntent"%'
  ) OR EXISTS (
    SELECT 1 FROM "ai_generations"
    WHERE COALESCE("output_json"::TEXT, '') LIKE '%"visualIntent"%'
  ) OR EXISTS (
    SELECT 1 FROM "background_jobs"
    WHERE COALESCE("input_meta_json"::TEXT, '') LIKE '%"visualIntent"%'
       OR COALESCE("result_json"::TEXT, '') LIKE '%"visualIntent"%'
  ) OR EXISTS (
    SELECT 1 FROM "stem_figure_revisions"
    WHERE COALESCE("reference_snapshot_json"::TEXT, '') LIKE '%"visualIntent"%'
       OR COALESCE("provider_request_snapshots_json"::TEXT, '') LIKE '%"visualIntent"%'
  ) THEN
    RAISE EXCEPTION 'STEM_FIGURE_PLAN_V3_POSTCONDITION_FAILED';
  END IF;
END
$$;
