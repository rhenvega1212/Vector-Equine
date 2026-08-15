import { createAdminClient } from "@/lib/supabase/admin";
import {
  hashDeviceSecret,
  parseEdgeDeviceAuth,
  verifyEdgeSessionToken,
  type EdgeSessionClaims,
} from "@/lib/capture/edge-token";

export type EdgeDeviceRow = {
  id: string;
  rider_id: string;
  device_key: string;
  label: string;
};

export async function authenticateEdgeDevice(
  authHeader: string | null
): Promise<EdgeDeviceRow | null> {
  const parsed = parseEdgeDeviceAuth(authHeader);
  if (!parsed || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("edge_devices")
    .select("id, rider_id, device_key, label, device_secret_hash")
    .eq("device_key", parsed.deviceKey)
    .maybeSingle();

  if (!data?.device_secret_hash) return null;
  const got = hashDeviceSecret(parsed.deviceSecret);
  if (got !== data.device_secret_hash) return null;

  await admin
    .from("edge_devices")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", data.id);

  return {
    id: data.id as string,
    rider_id: data.rider_id as string,
    device_key: data.device_key as string,
    label: data.label as string,
  };
}

export function authenticateEdgeSession(
  authHeader: string | null
): EdgeSessionClaims | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return verifyEdgeSessionToken(authHeader.slice(7));
}
