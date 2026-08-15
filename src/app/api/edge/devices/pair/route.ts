import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  generateDeviceKey,
  hashDeviceSecret,
  mintDeviceSecret,
} from "@/lib/capture/edge-token";
import { z } from "zod";

const pairSchema = z.object({
  label: z.string().trim().min(1).max(80).optional(),
  device_key: z
    .string()
    .trim()
    .min(3)
    .max(64)
    .regex(/^[a-z0-9][a-z0-9_-]*$/i)
    .optional(),
});

/**
 * Rider pairs a Jetson. Returns device_key + device_secret once.
 * Configure the agent with:
 *   Authorization: Edge <device_key>:<device_secret>
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = pairSchema.parse(body);
    const label = parsed.label?.trim() || "Jetson";
    const deviceKey = parsed.device_key || generateDeviceKey(label);
    const deviceSecret = mintDeviceSecret();
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("edge_devices")
      .insert({
        rider_id: user.id,
        label,
        device_key: deviceKey,
        device_secret_hash: hashDeviceSecret(deviceSecret),
      })
      .select("id, label, device_key, created_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "device_key already in use" },
          { status: 409 }
        );
      }
      // Table may not be migrated yet
      console.error("edge pair", error);
      return NextResponse.json(
        {
          error:
            error.message.includes("edge_devices")
              ? "Apply migration 20260804000000_edge_devices.sql first"
              : error.message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        device: data,
        device_secret: deviceSecret,
        auth_header_example: `Edge ${deviceKey}:${deviceSecret}`,
        note: "Store device_secret on the Jetson only — it is not shown again.",
      },
      { status: 201 }
    );
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.errors }, { status: 400 });
    }
    console.error("edge pair", e);
    return NextResponse.json({ error: "Pair failed" }, { status: 500 });
  }
}

/** List rider's edge devices (no secrets). */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("edge_devices")
      .select("id, label, device_key, last_seen_at, created_at")
      .eq("rider_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ devices: [], error: error.message });
    }
    return NextResponse.json({ devices: data || [] });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
