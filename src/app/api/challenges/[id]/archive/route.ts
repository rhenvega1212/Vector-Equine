import { NextRequest, NextResponse } from "next/server";
import { getArchiveData } from "@/lib/challenges/archive";

/**
 * GET /api/challenges/[id]/archive
 * Returns participant-only content for an archived challenge: assignment titles and submissions (no company content).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await getArchiveData(id);
    if (!data) {
      return NextResponse.json(
        { error: "Challenge not found or not archived" },
        { status: 404 }
      );
    }
    return NextResponse.json(data);
  } catch (e) {
    console.error("Archive API error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
