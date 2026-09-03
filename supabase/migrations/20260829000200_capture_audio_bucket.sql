-- A0.1: the bucket is infrastructure, not something the request path creates.
--
-- Lesson audio was originally dropped because bucket creation stalled lab
-- rides. Declaring it here means the upload path can assume it exists, and
-- nobody has to remember a dashboard step.
--
-- Audio shares the bucket with lesson video under the capture-audio/ prefix.
-- Private: reads go through the service role or a signed URL.

DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NULL THEN
    RAISE NOTICE 'storage.buckets not present — skipping bucket creation';
    RETURN;
  END IF;

  INSERT INTO storage.buckets (id, name, public)
  VALUES ('session-videos', 'session-videos', false)
  ON CONFLICT (id) DO NOTHING;
END $$;
