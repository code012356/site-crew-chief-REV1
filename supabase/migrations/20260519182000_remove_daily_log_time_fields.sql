-- Remove legacy start/end time fields from daily log JSON payloads.
-- Daily log records now store only hours per worker/equipment task.

UPDATE public.daily_logs
SET
  entries = COALESCE((
    SELECT jsonb_agg(entry - 'startTime' - 'endTime')
    FROM jsonb_array_elements(entries) AS entry
  ), '[]'::jsonb),
  equipment_usage = COALESCE((
    SELECT jsonb_agg(usage_entry - 'startTime' - 'endTime')
    FROM jsonb_array_elements(equipment_usage) AS usage_entry
  ), '[]'::jsonb),
  revisions = CASE
    WHEN revisions IS NULL THEN NULL
    ELSE COALESCE((
      SELECT jsonb_agg(
        revision
        || jsonb_build_object(
          'entries',
          COALESCE((
            SELECT jsonb_agg(revision_entry - 'startTime' - 'endTime')
            FROM jsonb_array_elements(COALESCE(revision->'entries', '[]'::jsonb)) AS revision_entry
          ), '[]'::jsonb),
          'equipmentUsage',
          COALESCE((
            SELECT jsonb_agg(revision_usage - 'startTime' - 'endTime')
            FROM jsonb_array_elements(COALESCE(revision->'equipmentUsage', '[]'::jsonb)) AS revision_usage
          ), '[]'::jsonb)
        )
      )
      FROM jsonb_array_elements(revisions) AS revision
    ), '[]'::jsonb)
  END;
