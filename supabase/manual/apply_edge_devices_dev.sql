-- Dev helper copy of 20260804000000_edge_devices.sql
-- Paste into Supabase SQL editor if not using `supabase db push`.

CREATE TABLE IF NOT EXISTS edge_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Jetson',
  device_key TEXT NOT NULL,
  device_secret_hash TEXT NOT NULL,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_devices_device_key_unique UNIQUE (device_key)
);

CREATE INDEX IF NOT EXISTS idx_edge_devices_rider ON edge_devices(rider_id);

ALTER TABLE capture_sessions
  ADD COLUMN IF NOT EXISTS edge_device_id UUID REFERENCES edge_devices(id) ON DELETE SET NULL;

ALTER TABLE capture_sessions
  ADD COLUMN IF NOT EXISTS edge_recording BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE capture_sessions
  ADD COLUMN IF NOT EXISTS edge_last_heartbeat_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_capture_sessions_edge_device
  ON capture_sessions(edge_device_id)
  WHERE edge_device_id IS NOT NULL;

ALTER TABLE edge_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Riders manage own edge devices" ON edge_devices;
CREATE POLICY "Riders manage own edge devices"
  ON edge_devices FOR ALL
  USING (auth.uid() = rider_id)
  WITH CHECK (auth.uid() = rider_id);
